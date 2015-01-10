//TODO : Consider ordering of rules and rulesets.
//TODO : Integrate RuleEngine with Condition on Processors
//TODO : Flatten the fact to pass it in the evaluation context when coming from processors => processor has context and context has data. The data part should become part of the fact
//TODO : Change BrokenRule Concept to be only for containing rules that have exceptions, potentially moving that as well to the evaluation context.
//TODO : Consider which "require" modules should be passed to the vm.context so that condition can be evaluated easily. JSONPath might be an interesting one, potentially inject a module that does nothing for now but that can be replaced by whatever we want at runtime (such as persistence)

(function (_, util, Rule, RuleCondition, EvaluationContext, EventEmitter, q, Injector) {

    'use strict';


    var RuleEvaluator = function RuleEvaluator(options) {

        EventEmitter.call(this);

        options = options || {};

        Object.defineProperty(this, "rules", {writable: true, value: {}});
        Object.defineProperty(this, "haltOnException", {writable: true, value: true});
        Object.defineProperty(this, "haltOnFirstTrueRule", {
            writable: true,
            value: false
        });
        Object.defineProperty(this, "haltOnFirstFalseRule", {
            writable: true,
            value: false
        });

        var _ruleSet = null;
        Object.defineProperty(this, "ruleSet", {
            get: function () {
                return _ruleSet;
            },
            set: function (value) {
                if (value) {
                    if (!(value instanceof RuleSet)) {
                        throw Error("The ruleSet is not of the proper type of RuleSet");
                    }

                    _ruleSet = value;
                }
            }
        });

        this.ruleSet = options.ruleSet;

        if (!options.ruleSet) {
            throw Error("A RuleSet needs to be provided to the RuleSetEvaluator");
        }

        for (var prop in this.ruleSet.rules) {
            this.addRule(this.ruleSet.rules[prop]);
        }

        this.haltOnException = _ruleSet.haltOnException;
        this.haltOnFirstFalseRule = _ruleSet.haltOnFirstFalseRule;
        this.haltOnFirstTrueRule = _ruleSet.haltOnFirstTrueRule;


        this.emit('ready');
    };

    util.inherits(RuleEvaluator, EventEmitter);

    RuleEvaluator.prototype.iterateRules = function (index, ruleArray, evaluationContext) {
        var self = this;
        var dfd = q.defer();

        function loop(loopResponse) {
            // When the result of calling `condition` is no longer true, we are
            // done.
            q.fcall(function () {
                return index < ruleArray.length
            }).then(function (conditionResult) {

                if (conditionResult) {
                    q.fcall(ruleArray[index].evaluateCondition.bind(ruleArray[index]), evaluationContext).then(function (ruleEvaluationResult) {

                        index++;
                        var response = {isTrue: true};
                        response.isTrue = !loopResponse.isTrue ? false : ruleEvaluationResult.isTrue;

                        if (ruleEvaluationResult.isTrue) {
                            if (self.haltOnFirstTrueRule) {
                                return dfd.resolve(response);
                            } else {
                                loop(response);
                            }
                        } else {
                            if (self.haltOnFirstFalseRule) {
                                return dfd.resolve(response);
                            } else {
                                loop(response);
                            }


                        }
                    }, function (error) {
                        index++;
                        evaluationContext.brokenRules.push(error);
                        var response = {isTrue: true};
                        //is it the right thing to assume the condition was true if it threw an exception? Probably not
                        response.isTrue = !loopResponse.isTrue ? false : false;
                        if (self.haltOnException) {
                            return dfd.resolve(response);
                        } else {

                            loop(response);
                        }
                    });
                }
                else {
                    return dfd.resolve(loopResponse);
                }

            }, function (error) {
                console.log("there is an error");
            }).done();
        }

        process.nextTick(function () {
            loop({isTrue: true});
        });

        // The promise
        return dfd.promise;
    };


    RuleEvaluator.prototype.evaluate = function (evaluationContext) {

        var dfd = q.defer();
        var self = this;

        process.nextTick(function () {

            var ruleArray = _.map(self.rules, function (item) {
                return item;
            });

            self.iterateRules(0, ruleArray, evaluationContext).then(function (rulesResult) {
                dfd.resolve(rulesResult);
            }, function (error) {
                dfd.resolve({isTrue: false});
            }).done();

        });

        return dfd.promise;

    };

    RuleEvaluator.prototype.addRule = function (rule) {

        var dfd = q.defer();

        if (!rule) {
            this.emit('ruleError', "The rule should be specified for evaluation.");
            dfd.reject("The rule should be specified for evaluation.");

        } else {

            if (!(rule instanceof Rule)) {
                this.emit('ruleError', "The rule to evaluate is not a rule object.");
                dfd.reject("The rule to evaluate is not a rule object.");
            } else {

                process.nextTick(function () {

                    if (this.rules) {
                        this.rules[rule.ruleName] = rule;

                        rule.evaluationContext = this.evaluationContext;

                        if (rule.condition.evaluationContext) {
                            rule.condition.evaluationContext.rules = this.rules;
                        }

                        dfd.resolve(rule);
                        this.emit('ruleAdded', rule);

                    } else {
                        this.emit('ruleError', "The rule list is not initialized.");
                        dfd.reject("The rule list is not initialized.");
                    }

                }.bind(this));

            }
        }
        return dfd.promise;
    };

    var RuleSet = function RuleSet(options) {
        options = options || {};

        Object.defineProperty(this, "rules", {writable: true, value: options.rules || {}});
        Object.defineProperty(this, "ruleSetName", {writable: true, value: options.ruleSetName || 'unknown'});
        Object.defineProperty(this, "haltOnException", {writable: true, value: options.haltOnException});
        Object.defineProperty(this, "haltOnFirstTrueRule", {
            writable: true,
            value: options.haltOnFirstTrueRule
        });
        Object.defineProperty(this, "haltOnFirstFalseRule", {
            writable: true,
            value: options.haltOnFirstFalseRule
        });
    };

    RuleSet.prototype.addRule = function (rule, addedRuleCallback) {

        var async_addRule = function (rule, callback) {
            process.nextTick(function () {
                if (!rule) {
                    throw Error("The rule should be specified for evaluation.");
                }

                if (!(rule instanceof Rule)) {
                    throw Error("The rule to evaluate is not a rule object.");
                }
                callback();
            }.bind(this));
        }.bind(this);

        var addRuleCompleted = function () {
            if (addedRuleCallback) {
                addedRuleCallback(rule);
            }
        }.bind(this);

        async_addRule(rule, addRuleCompleted);
    };

    function RuleSetLoader() {

    }

    RuleSetLoader.prototype.load = function (ruleSetName) {
        var dfd = q.defer();

        process.nextTick(function () {
            var ruleSet;

            try {
                ruleSet = require(engineConfig.ruleSetPath + '/' + ruleSetName);

            } catch (error) {
                dfd.reject("Unable to load ruleSet");
                return;
            }
            try {
                for (var r in ruleSet.rules) {
                    ruleSet.rules[r] = require(engineConfig.rulePath + '/' + r);
                    ruleSet.rules[r].internalName = r;
                }
            } catch (error) {
                dfd.reject("Unable to load rules");
                return;
            }

            dfd.resolve(ruleSet);
        });

        return dfd.promise;
    };

    var cache = {};

    function RuleSetCache() {

    }

    RuleSetCache.add = function (ruleSetName, ruleSet) {

        for (var prop in ruleSet.rules) {

            ruleSet.rules[prop].ruleName = ruleSet.ruleSetName + '_' + ruleSet.rules[prop].internalName;
        }
        cache[ruleSetName] = ruleSet;
    };

    RuleSetCache.get = function (ruleSetName) {
        if (!_.isUndefined(cache[ruleSetName])) return cache[ruleSetName];

        return null;
    };

    function RuleSetResolver(ruleSetLoader) {

        var _ruleSetLoader;
        Object.defineProperty(this, "ruleSetLoader", {
            get: function () {
                return _ruleSetLoader;
            },
            set: function (value) {
                if (_.isUndefined(value)) throw Error("A RuleSetLoader must be used");
                if (value instanceof RuleSetLoader) {
                    _ruleSetLoader = value;
                } else {
                    throw Error('RuleSetLoader is not of type RuleSetLoader or one of its descendant');
                }
            }
        });

        this.ruleSetLoader = ruleSetLoader;


        return this;
    }


    RuleSetResolver.prototype.load = function (ruleSetName) {

        var dfd = q.defer();
        var self = this;

        process.nextTick(function () {
            var parsedRuleSet = self.getFromCache(ruleSetName);

            if (parsedRuleSet == null) {
                self.ruleSetLoader.load(ruleSetName).then(function (ruleSetDefinition) {
                    parsedRuleSet = self.parseRuleSetDefinition(ruleSetDefinition);

                    self.addToCache(ruleSetName, parsedRuleSet);
                    dfd.resolve(parsedRuleSet);
                }).fail(function (error) {
                    dfd.resolve(error)
                });

            } else {
                dfd.resolve(parsedRuleSet);
            }
        });


        return dfd.promise;

    };

    RuleSetResolver.prototype.parseRuleSetDefinition = function (ruleSetDefinition) {
        return ruleSetDefinition;

    };

    RuleSetResolver.prototype.addToCache = function (ruleSetName, ruleSetDefinition) {
        RuleSetCache.add(ruleSetName, ruleSetDefinition);
    };

    RuleSetResolver.prototype.getFromCache = function (ruleSetName) {
        return RuleSetCache.get(ruleSetName);
    };

    function RuleEngine(ruleSetResolver) {
        var _ruleSetResolver;
        Object.defineProperty(this, "ruleSetResolver", {
            get: function () {
                return _ruleSetResolver;
            },
            set: function (value) {
                if (_.isUndefined(value)) throw Error("A RuleSetResolver must be used");
                if (value instanceof RuleSetResolver) {
                    _ruleSetResolver = value;
                } else {
                    throw Error('RuleSetResolver is not of type RuleSetResolver or one of its descendant');
                }
            }
        });

        this.ruleSetResolver = ruleSetResolver;
    }

    RuleEngine.prototype.evaluate = function (fact, ruleSetNames) {
        //ruleSetNames can be an array of names of rule set to load or a simple single name of a rule set to evaluate

        var arrRuleSetNames = [];
        var ruleSetEvaluator = [];

        var dfd = q.defer();


        if (!_.isArray(ruleSetNames) && _.isString(ruleSetNames)) {
            arrRuleSetNames.push(ruleSetNames);
        } else if (_.isArray(ruleSetNames)) {
            arrRuleSetNames = ruleSetNames;
        } else {
            throw Error("RuleSetNames should either be an array of string or a single string value.");
        }

        function initializeRuleSets(arr, iteratorFunc, binder) {
            var promises = _.map(arr, function (item) {
                return iteratorFunc.call(binder, item);
            });

            return q.all(promises);
        }

        function evaluateRuleSets(arr, evaluationContext) {
            var promises = _.map(arr, function (item) {
                return item.evaluate.call(item, evaluationContext);
            });

            return q.all(promises);
        }

        initializeRuleSets(arrRuleSetNames, this.ruleSetResolver.load, this.ruleSetResolver).then(function (result) {
            //we are done with loading all ruleSets
            for (var i = 0; i < result.length; i++) {
                ruleSetEvaluator.push(new RuleEvaluator({ruleSet: result[i]}));
            }
            var evaluationContext = new EvaluationContext({fact: fact});

            evaluateRuleSets(ruleSetEvaluator, evaluationContext).then(function (evaluationRuleSetResult) {
                var evaluationResult = _.reduce(evaluationRuleSetResult, function (result, current) {
                    var isTrue = result.isTrue ? current.isTrue && result.isTrue : false;
                    return {isTrue: isTrue}
                });
                dfd.resolve({isTrue: evaluationResult.isTrue, evaluationContext: evaluationContext});
            }).fail(function(error){
                evaluationContext.brokenRules.push(error);
                dfd.resolve({isTrue: false, evaluationContext: evaluationContext});
                return;
            });


        }).fail(function(error){
            dfd.reject(error);
            return;
        });

        return dfd.promise;
    };

    var engineConfig = {};
    RuleEngine.config = function (config) {
        engineConfig.ruleSetPath = config.ruleSetPath;
        engineConfig.rulePath = config.rulePath;
    };

//Exports
    exports.RuleEvaluator = RuleEvaluator;
    exports.RuleSet = RuleSet;
    exports.RuleEngine = RuleEngine;
    exports.RuleSetResolver = RuleSetResolver;
    exports.RuleSetLoader = RuleSetLoader;

    Injector.setBasePath(__dirname);
    Injector
        .register({dependency: '/RuleEvaluator::RuleSetResolver', name: 'ruleSetResolver'})
        .register({dependency: '/RuleEvaluator::RuleSetLoader', name: 'ruleSetLoader'})
        .register({dependency: '/RuleEvaluator::RuleEngine', name: 'ruleEngine'});


})(
    require('lodash'),
    require('util'),
    require('./Rule').Rule,
    require('./Rule').RuleCondition,
    require('./Rule').EvaluationContext,
    require('events').EventEmitter,
    require('q'),
    require('jsai-injector')
);
