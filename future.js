/**
 * @author https://github.com/rmruano
 * @license https://github.com/rmruano/futurejs/blob/master/LICENSE
 *
 * In house library for returning futures that can be resolved as success
 * error or cancelled. Data can be stored with the setData & getData methods
 * Not meant to be extended. No dependencies used
 */

var Future, FutureGroup;

function Future() {
    var debug, completed, completedSuccess, completedError, completedErrorException, completedCancel, completeListeners, successListeners, errorListeners, cancelListeners, id, data, group;
    debug = false;
    completed = false;
    completedSuccess = false;
    completedError = false;
    completedErrorException = null;
    completedCancel = false;
    completeListeners = [];
    successListeners = [];
    errorListeners = [];
    cancelListeners = [];
    id = new Date().getTime();
    data = {};
    group = false; /* Does this future belongs to some FutureGroup? */
    this.setData = function(id, dataToStore) {
        data[id] = dataToStore;
    };
    this.getData = function(id) {
        return (typeof data[id] !== "undefined" ? data[id] : null);
    };
    this.log = function(msg) {
        if (debug && typeof console === "object") {
            if (typeof msg === "string") console.log("Future "+this.getId()+" ("+new Date().toISOString()+"): "+msg);
            else if (typeof msg === "object") console.dir(msg);
        }
    };
    this.enableDebug = function() {debug=true;return this;};
    this.isGroup = function() {return false;};
    this.isCompleted = function() {return completed;};
    this.isCancel = function() {return (completed && completedCancel);};
    this.isSuccess = function() {return (completed && completedSuccess);};
    this.isError = function() {return (completed && completedError);};
    this.getId = function() {return id;};
    this.setFutureGroup = function (futureGroup) {
        if (typeof futureGroup === "undefined" || !(futureGroup instanceof FutureGroup)) throw new Error("Not a FutureGroup instance");
        group=futureGroup;
    };
    /**
     * Register a function to be run on complete
     */
    this.addListener = function(callback) {
        this.log("Listener added");
        if (typeof callback == "function") completeListeners.push(callback);
        if (this.isSuccess()) this.success(); // Already completed as success, do it right now
        if (this.isError()) this.error(); // Already completed as error, do it right now
        if (this.isCancel()) this.cancel(); // Already completed as cancel, do it right now
        return this;
    };
    /**
     * Register a function to be run on success
     */
    this.addSuccessListener = function(callback) {
        this.log("Success listener added");
        if (typeof callback == "function") successListeners.push(callback);
        if (this.isSuccess()) this.success(); // Already completed as success, do it right now
        return this;
    };
    /**
     * Register a function to be run on error
     * Error listeners receive a second parameter with the Error object
     */
    this.addErrorListener = function(callback) {
        this.log("Error listener added");
        if (typeof callback == "function") errorListeners.push(callback);
        if (this.isError()) this.error(); // Already completed as success, do it right now
        return this;
    };
    /**
     * Register a function to be run on cancel
     */
    this.addCancelListener = function(callback) {
        this.log("Cancel listener added");
        if (typeof callback == "function") cancelListeners.push(callback);
        if (this.isCancel()) this.cancel(); // Already completed as cancel, do it right now
        return this;
    };
    /**
     * Triggers the success event
     */
    this.success = function() {
        var listener;
        if (!(this.isCompleted())) { completed = true; completedSuccess = true; }
        if (this.isSuccess()) {
            this.log("Success triggered");
            while(typeof (listener = successListeners.shift()) != "undefined") listener(this); // Dispatch every remaining success listener
            while(typeof (listener = completeListeners.shift()) != "undefined") listener(this); // Dispatch every remaining complete listener
            if (group) group.futureCompleted();
        }
        else throw new Error("Cannot set Future to success state, already resolved to another completion status");
    };
    /**
     * Triggers the cancel event
     */
    this.cancel = function() {
        var listener;
        if (!(this.isCompleted())) { completed = true; completedCancel = true; }
        if (this.isCancel()) {
            this.log("Cancel triggered");
            while(typeof (listener = cancelListeners.shift()) != "undefined") listener(this); // Dispatch every remaining cancel listener
            while(typeof (listener = completeListeners.shift()) != "undefined") listener(this); // Dispatch every remaining complete listener
            if (group) group.futureCompleted();
        } else throw new Error("Future not cancellable, already resolved to another completion status");
    };
    /**
     * Returns the last error exception (if any)
     */
    this.getError = function() {
        return completedErrorException;
    };
    /**
     * Triggers the error event
     */
    this.error = function(error) {
        var listener;
        if (!(this.isCompleted())) { completed = true; completedError = true; }
        if (this.isError()) {
            if ((typeof error=="undefined" || !(error instanceof Error))) {
                if (typeof error == "string") error = new Error(error);
                else if (completedErrorException instanceof Error) error = completedErrorException; // Already set previously
                else error = new Error("Future's error state triggered, no error detail provided");
            }
            completedErrorException = error; // Save it for later
            this.log("Error triggered");
            this.log(error);
            while(typeof (listener = errorListeners.shift()) != "undefined") listener(this, error); // Dispatch every remaining error listener, the Error object is provided as a second parameter
            while(typeof (listener = completeListeners.shift()) != "undefined") listener(this); // Dispatch every remaining complete listener
            if (group) group.futureCompleted();
        } else throw new Error("Cannot set Future to error state, already resolved to another completion status");
    };
    /**
     * Flushes everything and waits for the garbage collector to kill us, after using this the Future is no longer usable
     */
    this.flush = function() {
        var voidClosure = function() {};
        delete completed, completedSuccess, completedError, completedErrorException, completedCancel, completeListeners, successListeners, errorListeners, cancelListeners, id, data;
        this.success = voidClosure; this.error = voidClosure; this.cancel = voidClosure; this.addListener = voidClosure; this.addSuccessListener = voidClosure;
        this.addCancelListener = voidClosure; this.addErrorListener = voidClosure; this.setData = voidClosure; this.getData = voidClosure;
    };
};

function FutureGroup() {
    var readyEventTimeout, readyDelay, id, cancelListeners, errorListeners, successListeners, completeListeners, ready, futures, debug, futureGroup, triggerSuccess, triggerCancel, triggerError;
    debug = false;
    futureGroup = this;
    futures = []; // Store the futures instances
    ready = false; // Finished adding futures?.
    completeListeners = [];
    successListeners = [];
    errorListeners = [];
    cancelListeners = [];
    id = new Date().getTime();
    /* Auto ready for the FutureGroup, for each future add, the group will wait this time for new futures, this will
     * prevent the callback to be called if the first future is already a success.
     * We can disable it with FutureGroup.disableAutoReady() and call FutureGroup.ready() once futures have been added.
     * Once the FutureGroup is in "ready" status, no more futures can be added to it.
     */
    readyDelay = 250;
    readyEventTimeout = null;
    this.getId = function() {return id;};
    this.log = function(msg) {
        if (debug && typeof console == "object") {
            if (typeof msg == "string") console.log("FutureGroup "+this.getId()+" ("+new Date().toISOString()+"): "+msg);
            else if (typeof msg == "object") console.dir(msg);
        }
    };
    this.disableAutoReady = function() {readyDelay=0;return this;}
    this.enableDebug = function() {debug=true;return this;};
    this.newFuture = function() {
        var future = new Future();
        this.add(future);
        return future;
    };
    this.add = function(future) {
        var futureObj;
        if (future === undefined) {
            throw new Error("Not a Future or function instance");
        }
        if (ready) {
            throw new Error("FutureGroup is in ready status, no more futures can be added");
        }
        // Schedule a new ready event, if no more futures added within this time frame, the FutureGroup will be marked ready
        if (readyEventTimeout) {
            clearTimeout(readyEventTimeout);
        }
        if (readyDelay>0) {
            readyEventTimeout = setTimeout(this.ready, readyDelay);
        }
        if (typeof future === "function") {
            this.log("Future closure added");
            // Create a new future with the function ass callback
            futureObj = new Future(debug);
            futures.push(futureObj); // Add the future
            futureObj.setFutureGroup(this); // Add group
            try {
                if (future()) {
                    futureObj.success(); // Instant success
                } else {
                    futureObj.error("Closure returned false!");
                }
            } catch (err) {
                futureObj.error(err); // Callback launched an exception
            }
        } else {
            if ( !(future instanceof Future)) {
                throw new Error("Not a Future instance");
            }
            this.log("Future added");
            futures.push(future); // Add the future
            future.setFutureGroup(this); // Add group
        }
        return this;
    };
    this.ready = function() {
        if (readyEventTimeout) {
            clearTimeout(readyEventTimeout);
        }
        futureGroup.log("Ready");
        ready = true;
        futureGroup.futureCompleted(); // Trigger a complete status check
    };
    this.isGroup = function() {return true;};
    this.getFutures = function() {return futures;};
    /**
     * Return futures that have been completed as error
     * @returns {Array}
     */
    this.getErrorFutures = function() {
        var errorFutures = [], i, j;
        for (i=0,j=futures.length;i<j;i+=1) {
            if (futures[i].isError()) {
                errorFutures.push(futures[i]);
            }
        }
        return errorFutures;
    };
    /**
     * Return errors of futures that have been completed as error
     * @returns {Array}
     */
    this.getErrors = function() {
        var errorFutures = this.getErrorFutures(), i, j, errors = [];
        for (i=0,j=errorFutures.length;i<j;i+=1) {
            errors.push(errorFutures[i].getError());
        }
        return errors;
    };
    this.isCompleted = function() {
        var i,j;
        if (futures.length===0) {
            return false;
        }
        for (i=0,j=futures.length;i<j;i+=1) {
            if (!futures[i].isCompleted()) {
                return false;
            }
        }
        return true;
    };
    this.isCancel = function() {
        var i,j;
        if (futures.length===0 || !this.isCompleted()) {
            return false;
        }
        for (i=0,j=futures.length;i<j;i+=1) {
            if (futures[i].isCancel()) {
                return true;
            }
        } // 1 cancel will trigger it
        return false;
    };
    this.isError = function() {
        var i,j;
        if (futures.length===0 || !this.isCompleted()) {
            return false;
        }
        for (i=0,j=futures.length;i<j;i+=1) {
            if (futures[i].isError()) {
                return true;
            }
        } // 1 error will trigger it
        return false;
    };
    this.isSuccess = function() {
        var i,j;
        if (futures.length===0 || !this.isCompleted()) {
            return false;
        }
        for (i=0,j=futures.length;i<j;i+=1) {
            if (!futures[i].isSuccess()) {
                return false;
            } // 1 non success will invalidate the success
        }
        return true;
    };
    /**
     * Register a function to be run on complete
     */
    this.addListener = function(callback) {
        this.log("Listener added");
        if (typeof callback === "function") {
            completeListeners.push(callback);
        }
        this.futureCompleted(); // Trigger a complete status check
        return this;
    };
    /**
     * Register a function to be run on success
     */
    this.addSuccessListener = function(callback) {
        this.log("Success listener added");
        if (typeof callback === "function") {
            successListeners.push(callback);
        }
        if (this.isSuccess()) {
            triggerSuccess();
        } // Already completed as success, do it right now
        return this;
    };
    /**
     * Register a function to be run on error
     * Error listeners receive a second parameter with the Error object
     */
    this.addErrorListener = function(callback) {
        this.log("Error listener added");
        if (typeof callback === "function") {
            errorListeners.push(callback);
        }
        if (this.isError()) {
            triggerError();
        } // Already completed as success, do it right now
        return this;
    };
    /**
     * Register a function to be run on cancel
     */
    this.addCancelListener = function(callback) {
        this.log("Cancel listener added");
        if (typeof callback === "function") {
            cancelListeners.push(callback);
        }
        if (this.isCancel()) {
            triggerCancel();
        } // Already completed as cancel, do it right now
        return this;
    };
    this.futureCompleted = function() {
        //this.log("Future completed");
        if (ready) {
            this.dumpStatus();
            // Dispatch every event types, it will check the futures status.
            triggerSuccess();
            triggerError();
            triggerCancel();
        }
    };
    this.dumpStatus = function() {
        var i,j;
        if (!debug) {
            return;
        }
        this.log("Future group status:");
        for (i=0,j=futures.length;i<j;i+=1) {
            this.log("    F"+futures[i].getId()+" > "+
            (futures[i].isCompleted() ? "Completed ("+
            (futures[i].isSuccess() ? "Success":"")+
            (futures[i].isError() ? "Error ":"")+
            (futures[i].isCancel() ? "Cancel":"")+")"
                :"Not completed"));
        }
    };
    this.flush = function() {
        if (futures.length===0) return false;
        for (var i=0,j=futures.length;i<j;i++) futures[i].flush();
    };
    /**
     * Triggers the success event
     */
    triggerSuccess = function() {
        var listener;
        if (futureGroup.isSuccess()) {
            futureGroup.log("Success triggered");
            while(typeof (listener = successListeners.shift()) != "undefined") listener(futureGroup); // Dispatch every remaining success listener
            while(typeof (listener = completeListeners.shift()) != "undefined") listener(futureGroup); // Dispatch every remaining complete listener
        }
    };
    /**
     * Triggers the cancel event (only if it's not an error)
     */
    triggerCancel = function() {
        var listener;
        if (!futureGroup.isError() && futureGroup.isCancel()) {
            futureGroup.log("Cancel triggered");
            while(typeof (listener = cancelListeners.shift()) != "undefined") listener(futureGroup); // Dispatch every remaining cancel listener
            while(typeof (listener = completeListeners.shift()) != "undefined") listener(futureGroup); // Dispatch every remaining complete listener
        }
    };
    /**
     * Triggers the error event
     */
    triggerError = function() {
        var listener, errors, lastError = null, i, j;
        if (futureGroup.isError()) {
            futureGroup.log("Error triggered");
            errors = futureGroup.getErrors();
            if (errors.length>0) lastError = errors[errors.length-1];
            while(typeof (listener = errorListeners.shift()) != "undefined") listener(futureGroup, lastError, futureGroup.getErrors()); // Dispatch every remaining error listener, an Array of Error objects is provided as a second parameter
            while(typeof (listener = completeListeners.shift()) != "undefined") listener(futureGroup); // Dispatch every remaining complete listener
        }
    };
};
