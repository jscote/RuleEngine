(function (util, Rule, BusinessRule, EventEmitter, q) {

    'use strict';


    var RuleEvaluator = function RuleEvaluator(options) {

        EventEmitter.call(this);

        options = options || {};

        Object.defineProperty(this, "rules", { writable: true, value: {} });
        Object.defineProperty(this, "hasExceptions", { writable: true, value: false });
        Object.defineProperty(this, "haltOnException", { writable: true, value: options.haltOnException || true });
        Object.defineProperty(this, "haltOnFirstInvalidRule", { writable: true, value: options.haltOnFirstInvalidRule || false });
        Object.defineProperty(this, "exceptionMessages", { writable: true, value: [] });
        Object.defineProperty(this, "brokenRules", { writable: true, value: [] });

        Object.defineProperty(this, "isValid", { writable: true, value: false, configurable: true });
        Object.defineProperty(this, "isValidated", { writable: true, value: false });
        Object.defineProperty(this, "isValidating", { writable: true, value: false });

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


    var BusinessRuleEvaluator = function BusinessRuleEvaluator(options) {
        options = options || {};
        RuleEvaluator.call(this, options);

        Object.defineProperty(this, "executeActionsOnCompletion", { writable: true, value: options.executeActionsOnCompletion === undefined ? false : options.executeActionsOnCompletion });
        Object.defineProperty(this, "executeActionsOnCompletionOnlyIfNoError", { writable: true, value: options.executeActionsOnCompletionOnlyIfNoError === undefined ? true : options.executeActionsOnCompletionOnlyIfNoError });
        this._deferredActions = [];

        this.on("evaluationStarting", function () {
            this._deferredActions = [];
        }.bind(this));

        this.on("allRulesEvaluated", function (evaluator) {
            if (this.executeActionsOnCompletion) {
                if ((this.executeActionsOnCompletionOnlyIfNoError && evaluator.isValid) || !this.executeActionsOnCompletionOnlyIfNoError) {
                    for (var i = 0; i < this._deferredActions.length; i++) {
                        this._deferredActions[i].execute();
                    }
                }
            }
        }.bind(this));

        return this;
    };

    util.inherits(BusinessRuleEvaluator, RuleEvaluator);

    BusinessRuleEvaluator.prototype.evaluateItem = function (rule) {
        if (!rule) {
            this.emit('error', "The rule should be specified for evaluation.");
        }

        if (!(rule instanceof Rule)) {
            this.emit('error', "The rule to evaluate is not a rule object.");
        }

        var result = rule.evaluateCondition();

        if (result) {
            if (rule.businessAction) {
                if (this.executeActionsOnCompletion) {
                    this._deferredActions.push(rule.businessAction);
                } else {
                    rule.businessAction.execute();
                }
            }
        }

        return result;
    };

    BusinessRuleEvaluator.prototype.addRule = function (rule) {

        var dfd = q.defer();

        if (!rule) {
            this.emit('ruleError', "The rule should be specified for evaluation.");
            dfd.reject("The rule should be specified for evaluation.");

        } else {

            if (!(rule instanceof BusinessRule)) {
                this.emit('ruleError', "The rule to evaluate is not a rule object.");
                dfd.reject("The rule to evaluate is not a rule object.");
            } else {

                process.nextTick(function () {

                    if (this.rules) {
                        this.rules[rule.ruleName] = rule;

                        rule.evaluationContext = this.evaluationContext;

                        if (rule.businessAction) {
                            rule.businessAction.evaluationContext = this.evaluationContext;
                        }

                        if (rule.condition.evaluationContext) {
                            rule.condition.evaluationContext.rules = this.rules;
                        }

                        dfd.resolve(rule);
                        this.emit('ruleAdded', rule);

                    } else {
                        this.emit('error', "The rule list is not initialized.");
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
        options = options || { };

        Object.defineProperty(this, "rules", { writable: true, value: {} });
        Object.defineProperty(this, "isValid", { writable: true, value: false });
        Object.defineProperty(this, "ruleSetName", { writable: true, value: options.ruleSetName || 'unknown' });
        Object.defineProperty(this, "haltOnException", { writable: true, value: options.haltOnException || true });
        Object.defineProperty(this, "haltOnFirstInvalidRule", { writable: true, value: options.haltOnFirstInvalidRule || false });

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

//Exports
    exports.RuleEvaluator = RuleEvaluator;
    exports.BusinessRuleEvaluator = BusinessRuleEvaluator;
    exports.RuleSetEvaluator = RuleSetEvaluator;
    exports.RuleSet = RuleSet;

})(
        require('util'),
        require('../Rule/Rule').Rule,
        require('../Rule/Rule').BusinessRule,
        require('events').EventEmitter,
        require('q')
    );
