//TODO : Adjust ProcessLoader to work with promise as they will most likely be loaded async
//TODO : Refactor Evaluate method on RuleEvaluator to loop on promises => consider using q.all(an array built from all rules calling evaluate as a promise for each rule).then(result)
//        - Partly done but need to take into account the Stop On First (true/false) rule as well as dealing with exception and broken rules.
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
        Object.defineProperty(this, "haltOnException", {writable: true, value: options.haltOnException || true});
        Object.defineProperty(this, "haltOnFirstTrueRule", {
            writable: true,
            value: options.haltOnFirstTrueRule || false
        });
        Object.defineProperty(this, "haltOnFirstFalseRule", {
            writable: true,
            value: options.haltOnFirstFalseRule || false
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


        this.emit('ready');
    };

    util.inherits(RuleEvaluator, EventEmitter);

    RuleEvaluator.prototype.evaluate = function (evaluationContext, fact) {

        var dfd = q.defer();
        var self = this;

        function evaluateRules(rules, evaluationContext, fact) {
            var promises = _.map(rules, function (rule) {
                return rule.evaluateCondition.call(rule, evaluationContext, fact);
            });

            return q.all(promises);
        }

        process.nextTick(function () {
            evaluateRules(self.rules, evaluationContext, fact).then(function (result) {
                var evaluationResult = _.reduce(result, function (result, current) {
                    var isTrue = result.isTrue ? current.isTrue && result.isTrue : false;
                    return {isTrue: isTrue};
                });
                dfd.resolve(evaluationResult);
            });
        });


        return dfd.promise;

/*
        if (!this.evaluationContext) {
            this.emit('evaluationError', "A rule needs a problem state to operate on.");
        } else {


            this.emit("evaluationStarting");

            var dfd = q.defer();

            //var async_evaluate = function (callback) {
            process.nextTick(function () {

                var self = this;
                var hasErrors = false;

                if (this.rules) {
                    for (var prop in this.rules) {
                        try {

                            this.evaluateItem(this.rules[prop]).then(function (result) {
                                //Keep track of broken rules. Instead of implementing this code in the evaluateItem function, it's done
                                //here because evaluateItem is most likely to be overridden by other type of evaluators and we want to preserve most of the code
                                if (!result.isTrue) {
                                    console.log("adding broken rule " + result.rule.ruleFriendlyName);
                                    self.brokenRules.push(result.rule.ruleFriendlyName);

                                    if (self.haltOnFirstInvalidRule) {
                                        self.emit('ruleEvaluated', result.rule);
                                        dfd.reject('Stop evaluation on first error');
                                    }
                                }

                                self.emit('ruleEvaluated', result.rule);
                            }).fail(function (reason) {
                                self.hasExceptions = true;
                                self.exceptionMessages.push(reason);
                            });


                        }
                        catch (e) {
                            this.hasExceptions = true;
                            this.exceptionMessages.push(e.message);

                            if (this.haltOnException) {
                                dfd.reject('Exception');
                                break;
                            }
                        }
                    }
                    dfd.resolve();
                } else {
                    this.emit('evaluationError', "The rule list is not initialized.");
                }
            }.bind(this));
            //}.bind(this);
        }

        var evaluationCompleted = function () {
            this.isValidating = false;
            this.isValidated = true;
            this.emit('allRulesEvaluated', this);
        }.bind(this);

        return dfd.promise;

        //async_evaluate(evaluationCompleted);
        */
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
        Object.defineProperty(this, "haltOnException", {writable: true, value: options.haltOnException || true});
        Object.defineProperty(this, "haltOnFirstTrueRule", {
            writable: true,
            value: options.haltOnFirstTrueRule || false
        });
        Object.defineProperty(this, "haltOnFirstFalseRule", {
            writable: true,
            value: options.haltOnFirstFalseRule || false
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
            if (ruleSetName == 'SomeTest') {
                ruleSet = new RuleSet({
                    ruleSetName: ruleSetName,
                    rules: {
                        "female20to40": new Rule({
                            ruleName: 'female20to40',
                            condition: new RuleCondition("isTrue = fact.gender !='M' && fact.age >=20 && fact.age <=40")
                        }),
                        "female": new Rule({
                            ruleName: 'female',
                            condition: new RuleCondition("isTrue = fact.gender !='M'")

                        })
                    }
                });
            }

            if (ruleSetName == 'SomeOtherTest') {
                ruleSet = new RuleSet({
                    ruleSetName: ruleSetName,
                    rules: {
                        "female20to40": new Rule({
                            ruleName: 'female10to50',
                            condition: new RuleCondition("isTrue = fact.gender !='M' && fact.age >=10 && fact.age <=50")
                        })
                    }
                });
            }

            dfd.resolve(ruleSet);
        });

        return dfd.promise;
    };

    var cache = {};

    function RuleSetCache() {

    }

    RuleSetCache.add = function (ruleSetName, ruleSetDefinition) {
        cache[ruleSetName] = ruleSetDefinition;
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
                var ruleSetDefinition = self.ruleSetLoader.load(ruleSetName);
                parsedRuleSet = self.parseRuleSetDefinition(ruleSetDefinition);

                self.addToCache(ruleSetName, parsedRuleSet);

            }
            dfd.resolve(parsedRuleSet);
        });


        return dfd.promise;

    };

    RuleSetResolver.prototype.parseRuleSetDefinition = function (ruleSetDefinition) {
        return ruleSetDefinition;

        if (_.isUndefined(ruleSetDefinition) || !ruleSetDefinition) {
            throw Error("Rule Set definition is not provided");
        }

        var materializedDefinition = {};

        function internalParse(innerDefinition) {
            var nodeType = '';
            var parameters = null;
            var inner = {};

            for (var prop in innerDefinition) {

                if (prop == 'nodeType') {
                    nodeType = innerDefinition[prop];
                } else if (prop == 'parameters') {
                    parameters = innerDefinition[prop];
                    if (!_.isUndefined(parameters)) {
                        for (var paramProp in parameters) {
                            if (paramProp == 'condition') {
                                inner[paramProp] = parameters[paramProp];
                            } else {
                                inner[paramProp] = internalParse(parameters[paramProp]);
                            }
                        }
                    }
                } else {
                    return innerDefinition[prop];
                }


            }
            return;
            //TODO Reparse this correctly
            //return NodeFactory.create(nodeType, inner);
        }

        materializedDefinition = internalParse(ruleSetDefinition);

        return materializedDefinition;
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
                return item.evaluate.call(item, evaluationContext, fact);
            });

            return q.all(promises);
        }

        initializeRuleSets(arrRuleSetNames, this.ruleSetResolver.load, this.ruleSetResolver).then(function (result) {
            //we are done with loading all ruleSets
            for (var i = 0; i < result.length; i++) {
                ruleSetEvaluator.push(new RuleEvaluator({ruleSet: result[i]}));
            }
            var evaluationContext = new EvaluationContext();

            evaluateRuleSets(ruleSetEvaluator, evaluationContext).then(function (evaluationRuleSetResult) {
                var evaluationResult = _.reduce(evaluationRuleSetResult, function (result, current) {
                    var isTrue = result.isTrue ? current.isTrue && result.isTrue : false;
                    return {isTrue : isTrue}
                });
                dfd.resolve(evaluationResult.isTrue);
            });


        });

        return dfd.promise;
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
