import { assert } from "chai";
import * as fs from 'fs/promises';
import { describe, suite, test } from "mocha";
import { TextDecoder } from "util";
import { parseCharmActionsYAML } from "../../charm.actions";
import { CharmConfigParameterProblem } from "../../charm.type";
import path = require("path");

suite(parseCharmActionsYAML.name, async function () {
    async function parseActions(relativePath: string): Promise<ReturnType<typeof parseCharmActionsYAML>> {
        return parseCharmActionsYAML(new TextDecoder().decode(await fs.readFile(path.join(__dirname, relativePath))));
    }

    test('valid', async function () {
        const { actions, problems } = await parseActions('../../../resource/test/actions.yaml/valid.actions.yaml');
        assert.isEmpty(problems, 'expected no file-scope problem');
        assert.lengthOf(actions, 3);
        assert.isFalse(actions.some(x => x.problems.length > 0), 'problem in some parameters');
    });

    test('invalid', async function () {
        const { actions, problems } = await parseActions('../../../resource/test/actions.yaml/invalid.actions.yaml');
        assert.lengthOf(problems, 0, 'expected no file-scope problem');
        assert.lengthOf(actions, 7);

        const allProblems = actions.map(x => x.problems).flat();
        assert.includeDeepMembers(allProblems, [
            { action: 'action-array-empty', message: 'Action entry `action-array-empty` must be an object.' },
            { action: 'action-array', message: 'Action entry `action-array` must be an object.' },
            { action: 'action-string', message: 'Action entry `action-string` must be an object.' },
            { action: 'action-number', message: 'Action entry `action-number` must be an object.' },
            { action: 'action-invalid-description-array-empty', message: 'Description for action `action-invalid-description-array-empty` should be a string.' },
            { action: 'action-invalid-description-array', message: 'Description for action `action-invalid-description-array` should be a string.' },
            { action: 'action-invalid-description-number', message: 'Description for action `action-invalid-description-number` should be a string.' },
        ]);
    });

    suite('invalid yaml structure', function () {
        const tests: { name: string; content: string; expectedProblems: CharmConfigParameterProblem[] }[] = [
            {
                name: 'invalid yaml',
                content: '123',
                expectedProblems: [{ message: "Invalid YAML file." }],
            },
            {
                name: 'empty',
                content: '',
                expectedProblems: [{ message: 'Invalid YAML file.' }],
            },
        ];

        for (const t of tests) {
            const tt = t;
            test(tt.name, function () {
                const { actions, problems } = parseCharmActionsYAML(tt.content);
                const allProblems = problems.concat(actions.map(x => x.problems).flat());
                assert.includeDeepMembers(allProblems, tt.expectedProblems);
            });
        }
    });
});

