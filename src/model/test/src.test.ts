import { assert } from "chai";
import * as fs from 'fs/promises';
import { suite, test } from "mocha";
import { TextDecoder } from "util";
import { CharmClassMethod, CharmSourceCodeFileAnalyzer } from "../src";
import path = require('path');

suite(CharmSourceCodeFileAnalyzer.name, async function () {
    async function makeSUT(fixtureName: string): Promise<CharmSourceCodeFileAnalyzer> {
        const base = path.join(__dirname, '../../../resource/test/ast');
        const content = new TextDecoder().decode(await fs.readFile(path.join(base, fixtureName + '.py')));
        const ast = JSON.parse(new TextDecoder().decode(await fs.readFile(path.join(base, fixtureName + '.json'))));
        return new CharmSourceCodeFileAnalyzer(content, ast);
    }
    test('charm-01', async function () {
        const sut = await makeSUT('charm-01');

        assert.isDefined(sut.charmClasses);
        assert.isDefined(sut.mainCharmClass);
        assert.equal(sut.mainCharmClass!.name, 'CharmWithEventHandlers');

        const cs0 = sut.charmClasses![0];
        assert.isDefined(cs0);
        assert.equal(cs0.name, 'CharmWithEventHandlers');
        assert.equal(cs0.base, 'CharmBase');
        assert.deepStrictEqual(cs0.range, { start: { line: 7, character: 0 }, end: { line: 17, character: 12 } });
        assert.deepStrictEqual(cs0.extendedRange, { start: { line: 7, character: 0 }, end: { line: 19, character: 0 } });
        assert.deepStrictEqual(cs0.methods, [
            { name: '__init__', kind: 'method', isStatic: false, positionalParameters: ['self'], range: { start: { line: 8, character: 4 }, end: { line: 11, character: 79 } }, extendedRange: { start: { line: 8, character: 4 }, end: { line: 13, character: 0 } } },
            { name: '_on_start', kind: 'method', isStatic: false, positionalParameters: ['self', 'event'], range: { start: { line: 13, character: 4 }, end: { line: 14, character: 12 } }, extendedRange: { start: { line: 13, character: 4 }, end: { line: 16, character: 0 } } },
            { name: '_on_config_changed', kind: 'method', isStatic: false, positionalParameters: ['self', 'event'], range: { start: { line: 16, character: 4 }, end: { line: 17, character: 12 } }, extendedRange: { start: { line: 16, character: 4 }, end: { line: 19, character: 0 } } },
        ] satisfies CharmClassMethod[]);

        const cs1 = sut.charmClasses![1];
        assert.isDefined(cs1);
        assert.equal(cs1.name, 'CharmWithProperties');
        assert.equal(cs1.base, 'CharmBase');
        assert.deepStrictEqual(cs1.range, { start: { line: 19, character: 0 }, end: { line: 29, character: 12 } });
        assert.deepStrictEqual(cs1.extendedRange, { start: { line: 19, character: 0 }, end: { line: 31, character: 0 } });
        assert.deepStrictEqual(cs1.methods, [
            { name: '__init__', kind: 'method', isStatic: false, positionalParameters: ['self'], range: { start: { line: 20, character: 4 }, end: { line: 21, character: 31 } }, extendedRange: { start: { line: 20, character: 4 }, end: { line: 23, character: 0 } } },
            { name: 'some_property', kind: 'getter', isStatic: false, positionalParameters: ['self'], range: { start: { line: 24, character: 4 }, end: { line: 25, character: 12 } }, extendedRange: { start: { line: 24, character: 4 }, end: { line: 27, character: 0 } } },
            { name: 'some_property', kind: 'setter', isStatic: false, positionalParameters: ['self', 'value'], range: { start: { line: 28, character: 4 }, end: { line: 29, character: 12 } }, extendedRange: { start: { line: 28, character: 4 }, end: { line: 31, character: 0 } } },
        ] satisfies CharmClassMethod[]);

        const cs2 = sut.charmClasses![2];
        assert.isDefined(cs2);
        assert.equal(cs2.name, 'CharmWithStaticMethods');
        assert.equal(cs2.base, 'CharmBase');
        assert.deepStrictEqual(cs2.range, { start: { line: 31, character: 0 }, end: { line: 37, character: 12 } });
        assert.deepStrictEqual(cs2.extendedRange, { start: { line: 31, character: 0 }, end: { line: 39, character: 0 } });
        assert.deepStrictEqual(cs2.methods, [
            { name: 'static_method', kind: 'method', isStatic: true, positionalParameters: [], range: { start: { line: 32, character: 4 }, end: { line: 33, character: 12 } }, extendedRange: { start: { line: 32, character: 4 }, end: { line: 35, character: 0 } } },
            { name: 'static_method_with_decorator', kind: 'method', isStatic: true, positionalParameters: ['param'], range: { start: { line: 36, character: 4 }, end: { line: 37, character: 12 } }, extendedRange: { start: { line: 36, character: 4 }, end: { line: 39, character: 0 } } },
        ] satisfies CharmClassMethod[]);
    });
});