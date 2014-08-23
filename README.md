FutureJS
========

An easy to use JavaScript library for returning futures/promises without any dependencies. Also supports future grouping
providing automatic wait-for-completion and evaluation of all grouped Futures.

FutureGroups will resolve to:
- *success*: if every future is success.
- *error*: if any future is an error.
- *cancel*: if any future is a cancel and there are no errors.

Take a look at ```demo_future.html``` & ```demo_futuregroup.html``` for all working examples and advanced usage. Do not forget to open the dev tools to see the output ;)

Returning a Future
------------------
Instead of accepting callbacks, your async function just return a Future object and triggers the result when completed.
```
function myAsyncFunction() {
    var future = new Future();
    future.enableDebug(); // This will send debug messages to the dev console
    setTimeout(function() {future.success();}, 1000); // Asynchronous success simulation
    // setTimeout(function() {future.cancel();}, 1000); // Asynchronous cancel simulation
    // setTimeout(function() {future.error(new Error("Something went wrong!");}, 1000); // Asynchronous error simulation
    return future;
};
```

Future EventListeners Sample
----------------------------
```
<script src="future.js"></script>
<input type="button" id="test1" value="TEST"/>
<script>
document.getElementById("test1").addEventListener("click", function() {
    var future = myAsyncFunction(); // It will return a Future object that will trigger the listeners when completed
    future.addSuccessListener(function(future) {
        alert("SuccessListener triggered");
    });
    future.addErrorListener(function(future, error) {
        alert("ErrorListener triggered: "+error.message);
    });
    future.addCancelListener(function(future) {
        alert("CancelListener triggered");
    });
    future.addListener(function(future) {
        alert("CompleteListener triggered (on any result)");
    });
});
</script>
```

Returning FutureGroups
----------------------
When multiple asynchronous operations must be performed, your async function can return a FutureGroup and add Future objects
returned by other asynchronous functions, the FutureGroup will automatically wait for all futures to be completed and
will also resolve automatically the result that must be triggered. You can also easily add synchronous closures as well.
```
function myComplexAsyncFunction() {
    var futureGroup = new FutureGroup()
        .enableDebug() // This will send debug messages to the dev console
        .add(myAsyncFunction1())
        .add(myAsyncFunction2())
        .add(myAsyncFunction3())
        .add(function(){/* My super awesome synchronous closure that returns TRUE for ok or FALSE for ko */});
    return futureGroup;
};
```

FutureGroup EventListeners Sample
---------------------------------
```
<script src="future.js"></script>
<input type="button" id="test1" value="TEST"/>
<script>
document.getElementById("test1").addEventListener("click", function() {
    var futureGroup = myComplexAsyncFunction(); // It will return a FutureGroup object that will trigger the listeners when completed
    futureGroup.addSuccessListener(function(futureGroup) {
        alert("SuccessListener triggered");
    });
    futureGroup.addErrorListener(function(futureGroup, lastError, errorsList) {
        alert("ErrorListener triggered: "+lastError.message);
        // errorList contains a Error[]
    });
    futureGroup.addCancelListener(function(futureGroup) {
        alert("CancelListener triggered");
    });
    futureGroup.addListener(function(futureGroup) {
        alert("CompleteListener triggered");
    });
});
</script>
```
