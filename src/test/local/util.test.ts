import { describe, suite, test } from "mocha";
import { toValidSymbol } from "../../util";
import { assert } from "chai";


test(toValidSymbol.name, function () {
    assert.equal(toValidSymbol(''), '');
    assert.equal(toValidSymbol('abc'), 'abc');
    assert.equal(toValidSymbol('AbC'), 'AbC');
    assert.equal(toValidSymbol('a-b'), 'a_b');
    assert.equal(toValidSymbol('-a-b'), '_a_b');
});

