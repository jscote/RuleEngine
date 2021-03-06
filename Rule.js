﻿(function (util, _, q, vm, contract, mapper) {

    'use strict';

    var EvaluationContext = function (options) {
        options = options || {};
        this.ruleStates = {};

        Object.defineProperty(this, "isValid", {writable: true, enumerable: true, value: false});
        Object.defineProperty(this, "brokenRules", {writable: true, enumerable: true, value: []});
        Object.defineProperty(this, "fact", {writable: true, enumerable: true, value: options.fact || null});
    };

    EvaluationContext.prototype.isEvaluated = function (ruleName) {
        if (_.isUndefined(this.ruleStates[ruleName])) return false;

        return this.ruleStates[ruleName].isEvaluated;
    };

    EvaluationContext.prototype.isTrue = function (ruleName) {
        if (_.isUndefined(this.ruleStates[ruleName])) throw Error("Rule state is unavailable.");

        return this.ruleStates[ruleName].isTrue;
    };

    EvaluationContext.prototype.setIsTrue = function (ruleName, isTrue) {
        if (_.isUndefined(this.ruleStates[ruleName])) this.ruleStates[ruleName] = new RuleState();
        this.ruleStates[ruleName].isTrue = isTrue;

        if (this.isValid) this.isValid = isTrue;
    };

    var RuleState = function () {
        var _isTrue = false;
        var self = this;
        Object.defineProperty(this, "isEvaluated", {value: false, writable: true, enumerable: true});
        Object.defineProperty(this, "isTrue", {
            get: function () {
                if (!self.isEvaluated) {
                    throw Error("Condition must be evaluated prior to know if it is true or false.");
                }
                return _isTrue;
            },
            set: function (value) {
                _isTrue = value;
                self.isEvaluated = true;
            }
        });
    };

    //Rule and Rule Condition are not combined in one object only for the following reasons:
    //- It is possible to derive the Rule object and create a new type that handles condition differently
    //- It is possible to implement a different type of RuleCondition
    //- It is possible to derive Rule object and and rule actions.
    var Rule = function Rule(options) {
        options = options || {};

        if (!options.ruleName) throw Error("A ruleName must be specified");

        Object.defineProperty(this, "ruleName", {value: options.ruleName, enumerable: true, writable: true});
        Object.defineProperty(this, "ruleFriendlyName", {
            value: options.ruleFriendlyName || options.ruleName,
            enumerable: true
        });

        var _condition = null;
        Object.defineProperty(this, "condition", {
            get: function () {
                return _condition;
            },
            set: function (value) {
                if (value) {
                    if (!(value instanceof RuleCondition)) {
                        throw Error("Condition should be of type RuleCondition.");
                    }
                }
                _condition = value;

            }, enumerable: true
        });

        options.condition = options.condition || null;

        if (options.condition === null)
        //set a condition that returns true all the time
            options.condition = new RuleCondition("isTrue = true");

        this.condition = options.condition;

        return this;
    };

    Rule.prototype.initializeMap = function(maps){
        this.condition.initializeMap(maps);
    };

    Rule.prototype.evaluateCondition = function (evaluationContext) {

        var self = this;
        var dfd = q.defer();

        if (this.condition) {
            this.condition.evaluateCondition(evaluationContext).then(function (result) {
                evaluationContext.setIsTrue(self.ruleName, result);
                dfd.resolve({isTrue: result, ruleState: evaluationContext.ruleStates[self.ruleName]});
            }, function (error) {
                dfd.reject(error);
            });
        } else {
            evaluationContext.ruleStates[self.ruleName].isTrue = true;
            dfd.resolve({isTrue: true, ruleState: evaluationContext.ruleStates[self.ruleName]});
        }

        return dfd.promise;
    };

    var RuleCondition = function RuleCondition(parameters) {

        var _predicate;
        Object.defineProperty(this, "predicate", {
            get: function () {
                return _predicate;
            },
            set: function (value) {
                if (_.isUndefined(value) || _.isNull(value)) {
                    throw Error('A predicate must be provided');
                }
                _predicate = value;
            }
        });

        var _contract;
        Object.defineProperty(this, "contract", {
            get: function () {
                return _contract;
            },
            set: function (value) {
                if (!(value instanceof contract.Contract)) {
                    if (_.isArray(value)) {
                        _contract = new contract.Contract(value);
                    } else {
                        throw Error("Contract is not a valid type")
                    }
                } else {
                    _contract = value;
                }
            }
        });

        Object.defineProperty(this, "mapIn", {enumerable: true, writable: true});
        Object.defineProperty(this, "mapOut", {enumerable: true, writable: true});

        if (_.isString(parameters)) {
            this.predicate = parameters;
        } else {
            if (_.isUndefined(parameters.predicate)) {
                this.predicate = parameters;
            } else {
                this.predicate = parameters.predicate;
                if (!_.isUndefined(parameters.contract))
                    this.contract = parameters.contract;

            }

        }


        return this;
    };

    RuleCondition.prototype.initializeMap = function(parameters){
        if (!_.isUndefined(parameters.mapIn)) {
            this.mapIn = contract.Contract.createMap(parameters.mapIn);
        }

        if (!_.isUndefined(parameters.mapOut)) {
            this.mapOut = parameters.mapOut;
        }

    };

    RuleCondition.prototype.evaluateCondition = function (evaluationContext) {

        var self = this;

        var dfd = q.defer();
        process.nextTick(function () {
            try {

                var args = null;
                if (!_.isUndefined(self.contract)) {
                    args = self.contract.createArguments();
                }

                if (!_.isUndefined(self.mapIn)) {
                    mapper.merge(evaluationContext.fact, args.in, self.mapIn);
                }

                if (_.isFunction(self.predicate)) {
                    q.fcall(self.predicate.bind(self), evaluationContext, args).then(function (result) {

                        if (!_.isUndefined(self.mapOut)) {
                            mapper.merge(args.out.flatten(), evaluationContext.fact, self.mapOut);
                        }

                        dfd.resolve(result.isTrue);
                    });
                } else {
                    var sandbox = {isTrue: false, evaluationContext: evaluationContext};
                    var context = vm.createContext(sandbox);
                    vm.runInContext(self.predicate, context);
                    dfd.resolve(context.isTrue);
                }
            } catch (e) {
                dfd.reject(e);
            }
        });


        return dfd.promise;
    };

//Exports
    exports.Rule = Rule;
    exports.RuleCondition = RuleCondition;
    exports.EvaluationContext = EvaluationContext;

})(
    require('util'),
    //require('../Predicate/Specification').PredicateSpecification,
    //require('../Predicate/Predicate').Predicate,
    require('lodash'),
    require('q'),
    require('vm'),
    require('jsai-contract'),
    require('object-mapper')
);