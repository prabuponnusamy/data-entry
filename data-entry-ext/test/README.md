# Parser tests

Regression tests for the message parser in `js/v3`. No dependencies and no
build step - they use Node's built-in test runner.

```sh
npm test              # or: node --test test/*.test.js
node --test-name-pattern "amount" test/*.test.js   # run a subset
```

## How it works

`harness.js` loads the extension's browser scripts into a fresh V8 context with
a stub `document`, so `parse(input)` runs the real `parseMessages()` - the same
code path as the page - and returns what would land in `#outputData`.

A fresh context per `parse()` call matters: the scripts keep state in
module-level globals (`lastTarget`, `imageMap`), so a shared context would let
one test's target leak into the next.

`harness.js` also fails if a new `js/v3/*.js` file is neither loaded nor listed
in `EXCLUDED_V3_FILES`, so a new pipeline step can't silently go untested.

## Adding a case

When a message parses wrong, add the exact message and the CSV it should
produce to `parse.test.js`:

```js
assertOutput('Bc\n09\n89', [
    '2DTkt,09,1,,BC',
    '2DTkt,89,1,,BC'
]);
```

These shapes interact - the rule that sends a trailing `RS 30` *up* to the
numbers above it is the same rule that must leave a `BC` header attached to the
numbers *below* it. Adding the broken message here is what stops the next fix
from trading one shape for another.

CSV column order is `type,number,qty,amount,target`. Note that 3D/4D/5D rows
carry an amount and no target, while 1D/2D rows carry a target and no amount.
