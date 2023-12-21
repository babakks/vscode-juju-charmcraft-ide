import { assert } from "chai";
import { suite, test } from "mocha";
import { Linter, LinterMessage, LinterOutputParser, codespellOutputParser, flake8OutputParser, mypyOutputParser, pydocstyleOutputParser, pylintOutputParser, ruffOutputParser } from "../lint.parser";
import { Range } from "../model/common";
import { newRange, unindent } from "./util";

suite.only(flake8OutputParser.name, function () {
    type TestCase = {
        name: string;
        content: string;
        expected: LinterMessage[];
    };
    const tests: TestCase[] = [
        {
            name: 'empty',
            content: '',
            expected: [],
        }, {
            name: 'whitespace',
            content: ' ',
            expected: [],
        }, {
            name: 'mixed whitespace and \\n',
            content: ' \n  \n ',
            expected: [],
        }, {
            name: 'single line',
            content: '/absolute/path:11:22: E303 too many blank lines',
            expected: [{
                linter: 'flake8',
                absolutePath: '/absolute/path',
                range: newRange(10, 21, 11, 0),
                message: 'E303 too many blank lines',
            }],
        }, {
            name: 'multiple lines',
            content: unindent(`
                /absolute/path/one:11:22: E### message 1
                /absolute/path/two:33:44: E### message 2
                /absolute/path/two:55:66: E### message 3
            `),
            expected: [{
                linter: 'flake8',
                absolutePath: '/absolute/path/one',
                range: newRange(10, 21, 11, 0),
                message: 'E### message 1',
            },
            {
                linter: 'flake8',
                absolutePath: '/absolute/path/two',
                range: newRange(32, 43, 33, 0),
                message: 'E### message 2',
            },
            {
                linter: 'flake8',
                absolutePath: '/absolute/path/two',
                range: newRange(54, 65, 55, 0),
                message: 'E### message 3',
            }],
        },
    ];

    for (const t of tests) {
        const tt = t;
        test(tt.name, function () {
            assert.deepStrictEqual(flake8OutputParser(tt.content.split('\n')), tt.expected);
        });
    }
});

suite.only(pylintOutputParser.name, function () {
    type TestCase = {
        name: string;
        content: string;
        expected: LinterMessage[];
    };
    const tests: TestCase[] = [
        {
            name: 'empty',
            content: '',
            expected: [],
        }, {
            name: 'whitespace',
            content: ' ',
            expected: [],
        }, {
            name: 'mixed whitespace and \\n',
            content: ' \n  \n ',
            expected: [],
        }, {
            name: 'single line',
            content: 'relative/path:11:22: C0303: Trailing whitespace (trailing-whitespace)',
            expected: [{
                linter: 'pylint',
                relativePath: 'relative/path',
                range: newRange(10, 22, 11, 0),
                message: 'C0303: Trailing whitespace (trailing-whitespace)',
            }],
        }, {
            name: 'multiple lines',
            content: unindent(`
                relative/path/one:11:22: C####: message 1
                relative/path/two:33:44: C####: message 2
                relative/path/two:55:66: C####: message 3
            `),
            expected: [{
                linter: 'pylint',
                relativePath: 'relative/path/one',
                range: newRange(10, 22, 11, 0),
                message: 'C####: message 1',
            },
            {
                linter: 'pylint',
                relativePath: 'relative/path/two',
                range: newRange(32, 44, 33, 0),
                message: 'C####: message 2',
            },
            {
                linter: 'pylint',
                relativePath: 'relative/path/two',
                range: newRange(54, 66, 55, 0),
                message: 'C####: message 3',
            }],
        },
    ];

    for (const t of tests) {
        const tt = t;
        test(tt.name, function () {
            assert.deepStrictEqual(pylintOutputParser(tt.content.split('\n')), tt.expected);
        });
    }
});

suite.only(ruffOutputParser.name, function () {
    type TestCase = {
        name: string;
        content: string;
        expected: LinterMessage[];
    };
    const tests: TestCase[] = [
        {
            name: 'empty',
            content: '',
            expected: [],
        }, {
            name: 'whitespace',
            content: ' ',
            expected: [],
        }, {
            name: 'mixed whitespace and \\n',
            content: ' \n  \n ',
            expected: [],
        }, {
            name: 'single line',
            content: 'relative/path:11:22: W291 [*] Trailing whitespace',
            expected: [{
                linter: 'ruff',
                relativePath: 'relative/path',
                range: newRange(10, 21, 11, 0),
                message: 'W291 [*] Trailing whitespace',
            }],
        }, {
            name: 'multiple lines',
            content: unindent(`
                relative/path/one:11:22: E### message 1
                relative/path/two:33:44: E### message 2
                relative/path/two:55:66: E### message 3
            `),
            expected: [{
                linter: 'ruff',
                relativePath: 'relative/path/one',
                range: newRange(10, 21, 11, 0),
                message: 'E### message 1',
            },
            {
                linter: 'ruff',
                relativePath: 'relative/path/two',
                range: newRange(32, 43, 33, 0),
                message: 'E### message 2',
            },
            {
                linter: 'ruff',
                relativePath: 'relative/path/two',
                range: newRange(54, 65, 55, 0),
                message: 'E### message 3',
            }],
        },
    ];

    for (const t of tests) {
        const tt = t;
        test(tt.name, function () {
            assert.deepStrictEqual(ruffOutputParser(tt.content.split('\n')), tt.expected);
        });
    }
});

suite.only(mypyOutputParser.name, function () {
    type TestCase = {
        name: string;
        content: string;
        expected: LinterMessage[];
    };
    const tests: TestCase[] = [
        {
            name: 'empty',
            content: '',
            expected: [],
        }, {
            name: 'whitespace',
            content: ' ',
            expected: [],
        }, {
            name: 'mixed whitespace and \\n',
            content: ' \n  \n ',
            expected: [],
        }, {
            name: 'single line',
            content: 'relative/path:11: error: something [scope]',
            expected: [{
                linter: 'mypy',
                relativePath: 'relative/path',
                range: newRange(10, 0, 11, 0),
                message: 'error: something [scope]',
            }],
        }, {
            name: 'multiple lines',
            content: unindent(`
                relative/path/one:11: error: message 1 [scope]
                relative/path/two:33: error: message 2 [scope]
                relative/path/two:55: error: message 3 [scope]
            `),
            expected: [{
                linter: 'mypy',
                relativePath: 'relative/path/one',
                range: newRange(10, 0, 11, 0),
                message: 'error: message 1 [scope]',
            },
            {
                linter: 'mypy',
                relativePath: 'relative/path/two',
                range: newRange(32, 0, 33, 0),
                message: 'error: message 2 [scope]',
            },
            {
                linter: 'mypy',
                relativePath: 'relative/path/two',
                range: newRange(54, 0, 55, 0),
                message: 'error: message 3 [scope]',
            }],
        },
    ];

    for (const t of tests) {
        const tt = t;
        test(tt.name, function () {
            assert.deepStrictEqual(mypyOutputParser(tt.content.split('\n')), tt.expected);
        });
    }
});

suite.only(codespellOutputParser.name, function () {
    type TestCase = {
        name: string;
        content: string;
        expected: LinterMessage[];
    };
    const tests: TestCase[] = [
        {
            name: 'empty',
            content: '',
            expected: [],
        }, {
            name: 'whitespace',
            content: ' ',
            expected: [],
        }, {
            name: 'mixed whitespace and \\n',
            content: ' \n  \n ',
            expected: [],
        }, {
            name: 'single line',
            content: '/absolute/path:11: adn ==> and',
            expected: [{
                linter: 'codespell',
                absolutePath: '/absolute/path',
                range: newRange(10, 0, 11, 0),
                message: 'adn ==> and',
            }],
        }, {
            name: 'multiple lines',
            content: unindent(`
                /absolute/path/one:11: adn ==> and
                /absolute/path/two:22: fro ==> for, from
                /absolute/path/two:33: fomr ==> from, form
            `),
            expected: [{
                linter: 'codespell',
                absolutePath: '/absolute/path/one',
                range: newRange(10, 0, 11, 0),
                message: 'adn ==> and',
            },
            {
                linter: 'codespell',
                absolutePath: '/absolute/path/two',
                range: newRange(21, 0, 22, 0),
                message: 'fro ==> for, from',
            },
            {
                linter: 'codespell',
                absolutePath: '/absolute/path/two',
                range: newRange(32, 0, 33, 0),
                message: 'fomr ==> from, form',
            }],
        },
    ];

    for (const t of tests) {
        const tt = t;
        test(tt.name, function () {
            assert.deepStrictEqual(codespellOutputParser(tt.content.split('\n')), tt.expected);
        });
    }
});


suite.only(pydocstyleOutputParser.name, function () {
    type TestCase = {
        name: string;
        content: string;
        expected: LinterMessage[];
    };
    const tests: TestCase[] = [
        {
            name: 'empty',
            content: '',
            expected: [],
        }, {
            name: 'whitespace',
            content: ' ',
            expected: [],
        }, {
            name: 'mixed whitespace and \\n',
            content: ' \n  \n ',
            expected: [],
        }, {
            name: 'single entry',
            content: unindent(`
            /absolute/path:11 in public function \`foo\`:
                    D102: Missing docstring in public method
            `),
            expected: [{
                linter: 'pydocstyle',
                absolutePath: '/absolute/path',
                range: newRange(10, 0, 11, 0),
                message: 'in public function \`foo\`: D102: Missing docstring in public method',
            }],
        }, {
            name: 'multiple entries',
            content: unindent(`
            /absolute/path/one:11 in function \`foo\`:
                    D###: message 1
            /absolute/path/two:22 in function \`bar\`:
                    D###: message 2
            /absolute/path/two:33 in function \`baz\`:
                    D###: message 3
            `),
            expected: [{
                linter: 'pydocstyle',
                absolutePath: '/absolute/path/one',
                range: newRange(10, 0, 11, 0),
                message: 'in function `foo`: D###: message 1',
            },
            {
                linter: 'pydocstyle',
                absolutePath: '/absolute/path/two',
                range: newRange(21, 0, 22, 0),
                message: 'in function `bar`: D###: message 2',
            },
            {
                linter: 'pydocstyle',
                absolutePath: '/absolute/path/two',
                range: newRange(32, 0, 33, 0),
                message: 'in function `baz`: D###: message 3',
            }],
        },
    ];

    for (const t of tests) {
        const tt = t;
        test(tt.name, function () {
            assert.deepStrictEqual(pydocstyleOutputParser(tt.content.split('\n')), tt.expected);
        });
    }
});