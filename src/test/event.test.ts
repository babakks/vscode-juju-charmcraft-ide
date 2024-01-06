import { assert } from "chai";
import { suite, test } from "mocha";
import { NonStackableEvent } from "../event";

suite(NonStackableEvent.name, function () {
    test('normal', async function () {
        let timesCalled = 0;
        let timesFinished = 0;
        const sut = new NonStackableEvent(async () => {
            timesCalled++;
            await new Promise(res => setImmediate(res));
            timesFinished++;
        });

        sut.fire();
        sut.fire();
        sut.fire();
        sut.fire();
        sut.fire();

        const firstPromise = sut.getPromise();
        assert.isDefined(firstPromise);
        await firstPromise!;

        // `timesFinished` Should be 1, because we only awaited the first
        // callback promise.
        assert.strictEqual(timesFinished, 1);
        // `timesCalled` Should be 2, because the callback should've been called
        // a second time, after the first call was finished.
        assert.strictEqual(timesCalled, 2);

        const secondPromise = sut.getPromise();
        assert.isDefined(secondPromise);
        await secondPromise!;

        assert.strictEqual(timesCalled, 2);
        assert.strictEqual(timesFinished, 2);
    });
});
