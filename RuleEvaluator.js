//TODO : Revise RuleEvaluator/RuleSetEvaluator => maybe only one is needed, especially with the concept of RuleEngine
//TODO : Refactor Evaluate method on RuleEvaluator to loop on promises => consider using q.all(an array built from all rules calling evaluate as a promise for each rule).then(result)
//TODO : Change haltOnFirstInvalidRule to two properties: haltOnFirstTrueRule and haltOnFirstFalseRule, setting one should set the other one off
//TODO : Consider introducing a RuleEngine class that coordinate the evaluation of all rule sets.
//TODO : Implementation of RuleEvaluator should initialize EvaluationContext and all rules in them (this may not be necessary as the evaluation context exposes methods to get IsEvaluated and IsTrue)
//TODO : Loading Rules from RuleSet with a RuleSetLoader/RuleSetResolver and cache (similar to processors)
//TODO : Integrate RuleEngine with Condition on Processors
//TODO : Flatten the fact to pass it in the evaluation context when coming from processors => processor has context and context has data. The data part should become part of the fact
//TODO : Change BrokenRule Concept to be only for containing rules that have exceptions, potentially moving that as well to the evaluation context.
//TODO : Consider which "require" modules should be passed to the vm.context so that condition can be evaluated easily. JSONPath might be an interesting one, potentially inject a module that does nothing for now but that can be replaced by whatever we want at runtime (such as persistence)
//TODO : The RuleEngine evaluate method should simply take a Fact as a parameter. The whole evaluation context can be hidden and created within the evaluate method and pass across.

(function (util, Rule, EventEmitter, q) {

    'use strict';


    var RuleEvaluator = function RuleEvaluator(options) {

        EventEmitter.call(this);

        options = options || {};

        Object.defineProperty(this, "rules", {writable: true, value: {}});
        Object.defineProperty(this, "hasExceptions", {writable: true, value: false});
        Object.defineProperty(this, "haltOnException", {writable: true, value: options.haltOnException || true});
        Object.defineProperty(this, "haltOnFirstInvalidRule", {
            writable: true,
            value: options.haltOnFirstInvalidRule || false
        });
        Object.defineProperty(this, "exceptionMessages", {writable: true, value: []});
        Object.defineProperty(this, "brokenRules", {writable: true, value: []});

        Object.defineProperty(this, "isValid", {writable: true, value: false, configurable: true});
        Object.defineProperty(this, "isValidated", {writable: true, value: false});
        Object.defineProperty(this, "isValidating", {writable: true, value: false});

        this.on("ruleEvaluated", function (rule) {
            console.log("onRuleEvaluated with " + rule.isTrue);
            if (!this.isValid) return;

            this.isValid = rule.isTrue;
        }.bind(this));


        var _evaluationContext = null;
        Object.defineProperty(this, "evaluationContext", {
            get: function () {
                return _evaluationContext;
            },
            set: function (value) {
                _evaluationContext = value;
            }
        });

        this.evaluationContext = options.evaluationContext || null;

        this.emit('ready');

        this.on("evaluationStarting", function () {
            this.brokenRules = [];
        }.bind(this));
    };

    util.inherits(RuleEvaluator, EventEmitter);

    RuleEvaluator.prototype.evaluateItem = function (rule) {
        if (!rule) {
            this.emit('error', "The rule should be specified for evaluation.");
        }

        if (!(rule instanceof Rule)) {
            this.emit('error', "The rule to evaluate is not a rule object.");
        }

        return rule.evaluateCondition();
    };

    RuleEvaluator.prototype.evaluate = function () {

        this.isValidating = true;
        this.isValidated = false;
        this.isValid = true;

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

    var RuleSetEvaluator = function RuleSetEvaluator(options) {
        options = options || {};
        RuleEvaluator.call(this, options);

        var self = this;
        var _isValid = false;
        Object.defineProperty(this, "isValid", {
            get: function () {
                return _isValid;
            },
            set: function (value) {
                _isValid = value;
                self.ruleSet.isValid = value;
            }
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

        this.evaluationContext = this.ruleSet.evaluationContext;
        this.haltOnException = this.ruleSet.haltOnException;
        this.haltOnFirstInvalidRule = this.ruleSet.haltOnFirstInvalidRule;


        return this;
    };

    util.inherits(RuleSetEvaluator, RuleEvaluator);

    var RuleSet = function RuleSet(options) {
        options = options || {};

        Object.defineProperty(this, "rules", {writable: true, value: {}});
        Object.defineProperty(this, "isValid", {writable: true, value: false});
        Object.defineProperty(this, "ruleSetName", {writable: true, value: options.ruleSetName || 'unknown'});
        Object.defineProperty(this, "haltOnException", {writable: true, value: options.haltOnException || true});
        Object.defineProperty(this, "haltOnFirstInvalidRule", {
            writable: true,
            value: options.haltOnFirstInvalidRule || false
        });

        var _evaluationContext = null;
        Object.defineProperty(this, "evaluationContext", {
            get: function () {
                return _evaluationContext;
            },
            set: function (value) {
                _evaluationContext = value;
            }
        });

        this.evaluationContext = options.evaluationContext || null;
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

                if (this.rules) {
                    this.rules[rule.ruleName] = rule;

                    rule.evaluationContext = this.evaluationContext;

                    if (rule.condition.evaluationContext) {
                        rule.condition.evaluationContext.rules = this.rules;
                    }

                } else {
                    throw Error("The rule list is not initialized.");
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

        //TODO the entire processor stuff should be built as a package that can be reuse across projects.

        var parsedRuleSet = this.getFromCache(ruleSetName);

        if (parsedRuleSet == null) {
            var ruleSetDefinition = this.ruleSetLoader.load(ruleSetName);
            parsedRuleSet = this.parseRuleSetDefinition(ruleSetDefinition);

            this.addToCache(ruleSetName, parsedRuleSet);

        }

        return parsedRuleSet;

    };

    RuleSetResolver.prototype.parseRuleSetDefinition = function (ruleSetDefinition) {
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
    };


//Exports
    exports.RuleEvaluator = RuleEvaluator;
    exports.RuleSetEvaluator = RuleSetEvaluator;
    exports.RuleSet = RuleSet;

})(
    require('util'),
    require('./Rule').Rule,
    require('events').EventEmitter,
    require('q')
);
