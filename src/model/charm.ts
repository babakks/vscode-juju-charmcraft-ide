import {
    CHARM_DIR_SRC_MAIN,
    CHARM_SOURCE_CODE_CHARM_BASE_CLASS,
    Position,
    Range,
    comparePositions,
    toValidSymbol
} from "./common";

export type CharmConfigParameterType = 'string' | 'int' | 'float' | 'boolean';
export function isConfigParameterType(value: string): value is CharmConfigParameterType {
    return value === 'string' || value === 'int' || value === 'float' || value === 'boolean';
}

export interface CharmConfigParameter {
    name: string;
    type?: CharmConfigParameterType;
    description?: string;
    default?: string | number | boolean;
    problems: CharmConfigParameterProblem[];
}

export interface CharmConfigParameterProblem {
    message: string;
    parameter?: string;
}

export interface CharmConfig {
    parameters: CharmConfigParameter[];
    problems: CharmConfigParameterProblem[];
}

export type CharmEndpointScope = 'global' | 'container';

export interface CharmEndpoint {
    name: string;
    interface: string;
    limit?: number;
    optional?: boolean;
    scope?: CharmEndpointScope;
    problems: CharmMetadataProblem[];
}

export type CharmResourceType = 'file' | 'oci-image' | 'unknown';

export interface CharmResource {
    name: string;
    type: CharmResourceType;
    description?: string;
    filename?: string;
    problems: CharmMetadataProblem[];
}


export type CharmDeviceType = 'gpu' | 'nvidia.com/gpu' | 'amd.com/gpu' | 'unknown';
export interface CharmDevice {
    name: string;
    type: CharmDeviceType;
    description?: string;
    countMin?: number;
    countMax?: number;
    problems: CharmMetadataProblem[];
}

export type CharmStorageType = 'filesystem' | 'block' | 'unknown';

export type CharmStorageProperty = 'transient' | 'unknown';

export interface CharmStorage {
    name: string;
    type: CharmStorageType;
    description?: string;
    location?: string;
    shared?: boolean;
    readOnly?: boolean;
    multiple?: string;
    minimumSize?: string;
    properties?: CharmStorageProperty[];
    problems: CharmMetadataProblem[];
}

export interface CharmExtraBinding {
    name: string;
    problems: CharmMetadataProblem[];
}

export interface CharmContainerBase {
    name: string;
    channel: string;
    architectures: string[];
    problems: CharmMetadataProblem[];
}

export interface CharmContainerMount {
    storage: string;
    location: string;
    problems: CharmMetadataProblem[];
}

export interface CharmContainer {
    name: string;
    resource?: string;
    bases?: CharmContainerBase[];
    mounts?: CharmContainerMount[];
    problems: CharmMetadataProblem[];
}

export interface CharmAssumptions {
    singles?: string[];
    allOf?: string[];
    anyOf?: string[];
    problems: CharmMetadataProblem[];
}

export interface CharmMetadataProblem {
    message: string;
    key?: string;
    index?: number;
}

export interface CharmMetadata {
    name: string;
    displayName: string
    description: string
    summary: string;
    source?: string | string[];
    issues?: string | string[];
    website?: string | string[];
    maintainers?: string[];
    tags?: string[];
    terms?: string[];
    docs?: string;
    subordinate?: boolean;
    requires?: CharmEndpoint[];
    provides?: CharmEndpoint[];
    peer?: CharmEndpoint[];
    resources?: CharmResource[];
    devices?: CharmDevice[];
    storage?: CharmStorage[];
    extraBindings?: CharmExtraBinding[];
    containers?: CharmContainer[];
    assumes?: CharmAssumptions;
    customFields: { [key: string]: any };
    problems: CharmMetadataProblem[];
}

export interface CharmEvent {
    name: string;
    symbol: string;
    preferredHandlerSymbol: string;
    description?: string;
}

export interface CharmAction {
    name: string;
    symbol: string;
    description?: string;
    problems: CharmActionProblem[];
}

export interface CharmActionProblem {
    message: string;
    action?: string;
}

export interface CharmActions {
    actions: CharmAction[];
    problems: CharmActionProblem[];
}

export class CharmSourceCodeFile {
    private _analyzer: CharmSourceCodeFileAnalyzer | undefined;
    constructor(public content: string, public ast: any, public healthy: boolean) { }
    get analyzer() {
        if (!this._analyzer) {
            this._analyzer = new CharmSourceCodeFileAnalyzer(this.content, this.ast);
        }
        return this._analyzer;
    }
}

export interface CharmSourceCodeTree {
    [key: string]: CharmSourceCodeTreeDirectoryEntry | CharmSourceCodeTreeFileEntry;
}

export interface CharmSourceCodeTreeDirectoryEntry {
    kind: 'directory';
    data: CharmSourceCodeTree;
}

export interface CharmSourceCodeTreeFileEntry {
    kind: 'file';
    data: CharmSourceCodeFile;
}

export interface CharmClass {
    range: Range;
    /**
     * Extended (greedy) range of the node that covers trailing whitespace or empty lines. 
     */
    extendedRange: Range;
    name: string;
    base: string;
    /**
     * Charm methods, ordered by their lexical position.
     */
    methods: CharmClassMethod[];
    subscribedEvents: CharmClassSubscribedEvent[];
};

export type CharmClassMethodKind = 'method' | 'getter' | 'setter';
export interface CharmClassMethod {
    range: Range;
    /**
     * Extended (greedy) range of the node that covers trailing whitespace or empty lines. 
     */
    extendedRange: Range;
    kind: CharmClassMethodKind;
    isStatic: boolean;
    name: string;
    positionalParameters: string[];
};

export interface CharmClassSubscribedEvent {
    event: string;
    handler: string;
};

export class CharmSourceCode {
    constructor(readonly tree: CharmSourceCodeTree) { }

    private _getEntryAt(relativePath: string): CharmSourceCodeTreeFileEntry | CharmSourceCodeTreeDirectoryEntry | undefined {
        const components = relativePath.split('/');
        let dir = this.tree;
        for (let i = 0; i < components.length; i++) {
            const current = dir[components[i]];
            if (!current) {
                return undefined;
            }
            const isLast = i === -1 + components.length;
            if (isLast) {
                return current;
            }
            if (current.kind !== 'directory') {
                return undefined;
            }
            dir = current.data;
        }
        return undefined;
    }

    getFile(relativePath: string): CharmSourceCodeFile | undefined {
        const entry = this._getEntryAt(relativePath);
        return entry?.kind === 'file' ? entry.data : undefined;
    }

    updateFile(relativePath: string, file: CharmSourceCodeFile) {
        const entry = this._getEntryAt(relativePath);
        if (entry?.kind === 'file') {
            entry.data = file;
        }
    }

    isMain(relativePath: string): boolean {
        // TODO: This may not be the exact criteria for the main charm file. 
        return relativePath === CHARM_DIR_SRC_MAIN;
    }
}

const NODE_TYPE_NAME = 'Name';
const NODE_TYPE_CLASS_DEF = 'ClassDef';
const NODE_TYPE_FUNCTION_DEF = 'FunctionDef';
const NODE_TYPE_ARGUMENTS = 'arguments';
const NODE_TYPE_ARG = 'arg';
const NODE_TYPE_ATTRIBUTE = 'Attribute';
const NODE_TYPE_IF = 'If';
const NODE_TYPE_COMPARE = 'If';
const NODE_TYPE_EQ = 'Eq';
const NODE_TYPE_CONSTANT = 'Constant';
const NODE_NAME_FUNCTION_INIT = '__init__';

const CONSTANT_VALUE_PROPERTY = 'property';
const CONSTANT_VALUE_NAME = '__name__';
const CONSTANT_VALUE_MAIN = '__main__';
const CONSTANT_VALUE_SETTER = 'setter';
const CONSTANT_VALUE_STATIC_METHOD = 'staticmethod';

export class CharmSourceCodeFileAnalyzer {
    private _charmClasses: CharmClass[] | undefined | null = null;
    private _mainCharmClass: CharmClass | undefined | null = null;
    private readonly _lines: string[];

    constructor(readonly content: string, readonly ast: any | undefined) {
        this._lines = content.split('\n').map(x => x.endsWith('\r') ? x.substring(0, -1 + x.length) : x);
    }

    /**
     * Resets analyses' results.
     */
    reset() {
        this._charmClasses = null;
        this._mainCharmClass = null;
    }

    /**
     * Charm-based classes, ordered by their lexical position.
     */
    get charmClasses(): CharmClass[] | undefined {
        if (this._charmClasses !== null) {
            return this._charmClasses;
        }
        return this._charmClasses = this._getCharmClasses();
    }

    get mainCharmClass(): CharmClass | undefined {
        if (this._mainCharmClass !== null) {
            return this._mainCharmClass;
        }
        return this._mainCharmClass = this._getMainCharmClass();
    }

    private _getCharmClasses(): CharmClass[] | undefined {
        const body = this.ast?.['body'];
        if (!body || !Array.isArray(body)) {
            return undefined;
        }

        const result: CharmClass[] = [];
        for (let i = 0; i < body.length; i++) {
            const cls = body[i];
            if (cls['$type'] !== NODE_TYPE_CLASS_DEF) {
                continue;
            }

            const bases = cls['bases'];
            if (!bases || !Array.isArray(bases)) {
                continue;
            }

            const baseClass = this._findAppropriateCharmBaseClass(bases);
            if (!baseClass) {
                continue;
            }

            const range = getNodeRange(cls);
            const extendedRange = getNodeExtendedRange(cls, body[1 + i]);

            result.push({
                name: unquoteSymbol(cls['name'] as string),
                base: baseClass,
                methods: this._getClassMethods(cls, extendedRange) ?? [],
                subscribedEvents: this._getClassSubscribedEvents(cls) ?? [],
                range,
                extendedRange,
            });
        }
        return result;
    }

    private _findAppropriateCharmBaseClass(bases: any[]): string | undefined {
        for (const b of bases) {
            if (b['$type'] === NODE_TYPE_NAME && b['id']) {
                // Cases: `class MyCharm(CharmBase)`
                const id = unquoteSymbol(b['id']);
                if (id === CHARM_SOURCE_CODE_CHARM_BASE_CLASS) {
                    return id;
                }
            } else if (b['$type'] === NODE_TYPE_ATTRIBUTE && b['attr']) {
                // Cases: `class MyCharm(ops.CharmBase)`
                const id = unquoteSymbol(b['attr']);
                if (id === CHARM_SOURCE_CODE_CHARM_BASE_CLASS) {
                    return id;
                }
            }
        }
        return undefined;
    }

    private _getMainCharmClass(): CharmClass | undefined {
        const classes = this.charmClasses;
        if (!classes) {
            return undefined;
        }

        const body = this.ast?.['body'];
        if (!body || !Array.isArray(body)) {
            return undefined;
        }

        const ifs = body.filter(x => x['$type'] === NODE_TYPE_IF).reverse();
        for (const x of ifs) {
            /*
             * Looking for:
             *
             *     if __name__=="__main__":
             */
            const isEntrypointIf =
                x['$type'] === NODE_TYPE_COMPARE
                && x['test']?.['left']?.['$type'] === NODE_TYPE_NAME
                && x['test']['left']['id'] && unquoteSymbol(x['test']['left']['id']) === CONSTANT_VALUE_NAME
                && x['test']['ops'] && x['test']['ops'].length && x['test']['ops'][0]?.['$type'] === NODE_TYPE_EQ
                && x['test']['comparators']?.[0]?.['$type'] === NODE_TYPE_CONSTANT
                && x['test']['comparators'][0]['value']
                && unquoteSymbol(x['test']['comparators'][0]['value']) === CONSTANT_VALUE_MAIN;
            if (!isEntrypointIf) {
                continue;
            }

            const nodeText = getTextOverRange(this._lines, getNodeRange(x));
            const charmClass = classes.find(x => nodeText.match(new RegExp(`(^\\s*|\\W)${escapeRegex(x.name)}(\\W|\\s*$)`)));
            if (charmClass) {
                return charmClass;
            }
        }
        return undefined;
    }

    private _getClassMethods(cls: any, clsExtendedRange: Range): CharmClassMethod[] | undefined {
        const body = cls['body'];
        if (!body || !Array.isArray(body)) {
            return undefined;
        }

        const result: CharmClassMethod[] = [];
        for (let i = 0; i < body.length; i++) {
            const method = body[i];
            if (method['$type'] !== NODE_TYPE_FUNCTION_DEF) {
                continue;
            }

            const positionalParameters = (method['args']?.['args'] as Array<any> ?? []).filter(x => x['$type'] === NODE_TYPE_ARG && x['arg']).map(x => unquoteSymbol(x['arg']));
            const range = getNodeRange(method);
            const isLast = i === -1 + body.length;
            const extendedRange = !isLast ? getNodeExtendedRange(method, body[1 + i]) : { start: range.start, end: clsExtendedRange.end };
            result.push({
                name: unquoteSymbol(method['name'] as string),
                kind: this._getMethodKind(method),
                isStatic: this._isClassMethodStatic(method),
                range,
                extendedRange,
                positionalParameters,
            });
        }
        result.sort((a, b) => comparePositions(a.range.start, b.range.start));
        return result;
    }

    private _getMethodKind(node: any): CharmClassMethodKind {
        const decorators = node['decorator_list'] as Array<any> ?? [];
        for (const d of decorators) {
            if (d['$type'] === NODE_TYPE_NAME && d['id']) {
                const id = unquoteSymbol(d['id']);
                if (id === CONSTANT_VALUE_PROPERTY) {
                    /*
                     * Property getters:
                     *
                     *    @property
                     *    def my_property(self):
                     */
                    return 'getter';
                }
            } else if (d['$type'] === NODE_TYPE_ATTRIBUTE && d['attr']) {
                const attr = unquoteSymbol(d['attr']);
                if (attr === CONSTANT_VALUE_SETTER) {
                    /*
                     * Property setters:
                     *
                     *    @my_property.setter
                     *    def my_property(self, value):
                     */
                    return 'setter';
                }
            }
        }
        return 'method';
    }

    private _isClassMethodStatic(node: any): boolean {
        if (node['args']?.['$type'] === NODE_TYPE_ARGUMENTS
            && Array.isArray(node['args']['args'])
            && node['args']['args'].length === 0) {
            /*
             * Class method with no parameters:
             *
             *    def my_method():
             */
            return true;
        }

        const decorators = node['decorator_list'] as Array<any> ?? [];
        for (const d of decorators) {
            if (d['$type'] === NODE_TYPE_NAME && d['id']) {
                const id = unquoteSymbol(d['id']);
                if (id === CONSTANT_VALUE_STATIC_METHOD) {
                    /*
                     * Static method:
                     *
                     *    @staticmethod
                     *    def my_method(param):
                     */
                    return true;
                }
            }
        }
        return false;
    }

    private _getClassSubscribedEvents(cls: any): CharmClassSubscribedEvent[] | undefined {
        // const body = cls.body;
        // if (!body || !Array.isArray(body)) {
        //     return undefined;
        // }

        // const result: CharmClassMethod[] = [];
        // const methods = body.filter(x => x.$type === NODE_TYPE_FUNCTION_DEF && unquoteSymbol(x.name) === NODE_NAME_FUNCTION_INIT);
        // for (const method of methods) {
        //     result.push({
        //         name: unquoteSymbol(method.name as string),
        //         range: getNodeRange(method),
        //     });
        // }
        // return result;
        return undefined;
    }
}

export function getNodeRange(node: any): Range {
    return {
        start: { line: -1 + Number.parseInt(node.lineno), character: Number.parseInt(node.col_offset) },
        end: { line: -1 + Number.parseInt(node.end_lineno), character: Number.parseInt(node.end_col_offset) },
    };
}

export function getNodeExtendedRange(node: any, nextNode: any): Range {
    const range = getNodeRange(node);
    if (!nextNode) {
        return getNodeRange(node);
    }
    const nextNodeRange = getNodeRange(nextNode);
    const firstDecorator = nextNode['decorator_list']?.[0];
    const nextNodeStart = firstDecorator ? getNodeRange(firstDecorator).start : nextNodeRange.start;
    return nextNodeStart.line === range.end.line
        ? { start: range.start, end: nextNodeStart }
        : { start: range.start, end: { line: nextNodeStart.line, character: 0 } };
}

export function unquoteSymbol(s: string): string {
    if (s.length < 2) {
        return s;
    }
    const quote = s.charAt(0);
    if (quote !== '"' && quote !== "'") {
        return s;
    }
    if (s.charAt(-1 + s.length) !== quote) {
        return s;
    }
    return s.substring(1, -1 + s.length);
}

const POSITION_ZERO = { line: 0, character: 0 };
export function getTextOverRange(lines: string[], range: Range): string {
    if (!lines.length) {
        return '';
    }

    const start = comparePositions(range.start, POSITION_ZERO) === -1 ? POSITION_ZERO : range.start;
    const max: Position = { line: -1 + lines.length, character: lines[-1 + lines.length].length };
    const end = comparePositions(range.end, max) === 1 ? max : range.end;

    if (comparePositions(start, end) === 1) {
        return '';
    }

    const portion = lines.slice(start.line, 1 + end.line);
    portion[-1 + portion.length] = portion[-1 + portion.length].substring(0, end.character);
    portion[0] = portion[0].substring(start.character);
    return portion.join('\n');
}

const REGEXP_SPECIAL_CHARS = /[/\-\\^$*+?.()|[\]{}]/g;
export function escapeRegex(s: string): string {
    return s.replace(REGEXP_SPECIAL_CHARS, '\\$&');
}

export type DeepSearchCallbackNode = { kind: 'object'; value: object } | { kind: 'array'; value: Array<any> };
export type DeepSearchCallback = (key: any, node: DeepSearchCallbackNode) => boolean | DeepSearchCallback;

export function deepSearch(node: any, callback: DeepSearchCallback) {
    _deepSearch([node], callback);
    function _deepSearch(node: any, callback: DeepSearchCallback) {
        if (typeof node !== 'object') {
            return;
        }
        if (Array.isArray(node)) {
            for (let i = 0; i < node.length; i++) {
                const element = node[i];
                if (typeof element !== 'object') {
                    continue;
                }
                const arg: DeepSearchCallbackNode = Array.isArray(element) ? { kind: 'array', value: element } : { kind: 'object', value: element };
                const dig = callback(i, arg);
                if (dig === false) {
                    continue;
                }
                const nextCallback = dig === true ? callback : dig;
                _deepSearch(element, nextCallback);
            }
        } else {
            for (const key in node) {
                const value = node[key];
                if (typeof value !== 'object') {
                    continue;
                }
                const arg: DeepSearchCallbackNode = Array.isArray(value) ? { kind: 'array', value: value } : { kind: 'object', value: value };
                const dig = callback(key, arg);
                if (dig === false) {
                    continue;
                }
                const nextCallback = dig === true ? callback : dig;
                _deepSearch(value, nextCallback);
            }
        }
    }
}

export function deepSearchForPattern(node: any, pattern: any): any | undefined {

}

function withReference(text: string, ...urls: string[]): string {
    return `${text}\n\n*Reference(s):*\n${urls.map(x => `  - ${x}`).join('\n')}`;
}

const CHARM_LIFECYCLE_EVENTS: CharmEvent[] = [
    Object.freeze({ name: 'start', symbol: 'start', preferredHandlerSymbol: '_on_start', description: withReference('Fired as soon as the unit initialization is complete.', 'https://juju.is/docs/sdk/start-event', 'https://juju.is/docs/sdk/a-charms-life',) }),
    Object.freeze({ name: 'config-changed', symbol: 'config_changed', preferredHandlerSymbol: '_on_config_changed', description: withReference('Fired whenever the cloud admin changes the charm configuration *.', 'https://juju.is/docs/sdk/config-changed-event', 'https://juju.is/docs/sdk/a-charms-life',) }),
    Object.freeze({ name: 'install', symbol: 'install', preferredHandlerSymbol: '_on_install', description: withReference('Fired when juju is done provisioning the unit.', 'https://juju.is/docs/sdk/install-event', 'https://juju.is/docs/sdk/a-charms-life',) }),
    Object.freeze({ name: 'leader-elected', symbol: 'leader_elected', preferredHandlerSymbol: '_on_leader_elected', description: withReference('Fired on the new leader when juju elects one.', 'https://juju.is/docs/sdk/leader-elected-event', 'https://juju.is/docs/sdk/a-charms-life',) }),
    Object.freeze({ name: 'leader-settings-changed', symbol: 'leader_settings_changed', preferredHandlerSymbol: '_on_leader_settings_changed', description: withReference('Fired on all follower units when a new leader is chosen.', 'https://juju.is/docs/sdk/leader-settings-changed-event', 'https://juju.is/docs/sdk/a-charms-life',) }),
    Object.freeze({ name: 'pre-series-upgrade', symbol: 'pre_series_upgrade', preferredHandlerSymbol: '_on_pre_series_upgrade', description: withReference('Fired before the series upgrade takes place.', 'https://juju.is/docs/sdk/pre-series-upgrade-event', 'https://juju.is/docs/sdk/a-charms-life',) }),
    Object.freeze({ name: 'post-series-upgrade', symbol: 'post_series_upgrade', preferredHandlerSymbol: '_on_post_series_upgrade', description: withReference('Fired after the series upgrade has taken place.', 'https://juju.is/docs/sdk/post-series-upgrade-event', 'https://juju.is/docs/sdk/a-charms-life',) }),
    Object.freeze({ name: 'stop', symbol: 'stop', preferredHandlerSymbol: '_on_stop', description: withReference('Fired before the unit begins deprovisioning.', 'https://juju.is/docs/sdk/stop-event', 'https://juju.is/docs/sdk/a-charms-life',) }),
    Object.freeze({ name: 'remove', symbol: 'remove', preferredHandlerSymbol: '_on_remove', description: withReference('Fired just before the unit is deprovisioned.', 'https://juju.is/docs/sdk/remove-event', 'https://juju.is/docs/sdk/a-charms-life',) }),
    Object.freeze({ name: 'update-status', symbol: 'update_status', preferredHandlerSymbol: '_on_update_status', description: withReference('Fired automatically at regular intervals by juju.', 'https://juju.is/docs/sdk/update-status-event', 'https://juju.is/docs/sdk/a-charms-life',) }),
    Object.freeze({ name: 'upgrade-charm', symbol: 'upgrade_charm', preferredHandlerSymbol: '_on_upgrade_charm', description: withReference('Fired when the cloud admin upgrades the charm.', 'https://juju.is/docs/sdk/upgrade-charm-event', 'https://juju.is/docs/sdk/a-charms-life',) }),
    Object.freeze({ name: 'collect-metrics', symbol: 'collect_metrics', preferredHandlerSymbol: '_on_collect_metrics', description: withReference('(deprecated, will be removed soon)', 'https://juju.is/docs/sdk/collect-metrics-event', 'https://juju.is/docs/sdk/a-charms-life',) }),
];

const CHARM_SECRET_EVENTS: CharmEvent[] = [
    Object.freeze({ name: 'secret-changed', symbol: 'secret_changed', preferredHandlerSymbol: '_on_secret_changed', description: withReference('The `secret-changed` event is fired on all units observing a secret after the owner of a secret has published a new revision for it.', 'https://juju.is/docs/sdk/event-secret-changed', 'https://juju.is/docs/sdk/a-charms-life',) }),
    Object.freeze({ name: 'secret-expired', symbol: 'secret_expired', preferredHandlerSymbol: '_on_secret_expired', description: withReference('If a secret was added with the expire argument set to some future time, when that time elapses, Juju will notify the owner charm that the expiration time has been reached by firing a `secret-expired` event on the owner unit.', 'https://juju.is/docs/sdk/event-secret-expired', 'https://juju.is/docs/sdk/a-charms-life',) }),
    Object.freeze({ name: 'secret-remove', symbol: 'secret_remove', preferredHandlerSymbol: '_on_secret_remove', description: withReference('The `secret-remove` event is fired on the owner of a secret when either:\n  - All observers tracking a now-outdated revision have updated to tracking a newer one, so the old revision can be removed.\n  - No observer is tracking an intermediate revision, and a newer one has already been created. So there is a orphaned revision which no observer will ever be able to peek or update to, because there is already a newer one the observer would get instead.', 'https://juju.is/docs/sdk/event-secret-remove', 'https://juju.is/docs/sdk/a-charms-life',) }),
    Object.freeze({ name: 'secret-rotate', symbol: 'secret_rotate', preferredHandlerSymbol: '_on_secret_rotate', description: withReference('The `secret-rotate` event is fired on the owner of a secret every time the rotation period elapses (and the event will keep firing until the owner rotates the secret).', 'https://juju.is/docs/sdk/event-secret-rotate', 'https://juju.is/docs/sdk/a-charms-life',) }),
];

const CHARM_RELATION_EVENTS_TEMPLATE = (endpoint: CharmEndpoint): CharmEvent[] => {
    return [
        { suffix: '-relation-broken', description: withReference('`relation-broken` is a "teardown" event and is emitted when an existing relation between two applications is fully terminated.', 'https://juju.is/docs/sdk/relation-name-relation-broken-event', 'https://juju.is/docs/sdk/integration', 'https://juju.is/docs/sdk/a-charms-life',) },
        { suffix: '-relation-changed', description: withReference('`relation-changed` is emitted when another unit involved in the relation (from either side) touches the relation data.', 'https://juju.is/docs/sdk/relation-name-relation-changed-event', 'https://juju.is/docs/sdk/integration', 'https://juju.is/docs/sdk/a-charms-life',) },
        { suffix: '-relation-created', description: withReference('`relation-created` is a "setup" event and, emitted when an application is related to another. Its purpose is to inform the newly related charms that they are entering the relation.', 'https://juju.is/docs/sdk/relation-name-relation-created-event', 'https://juju.is/docs/sdk/integration', 'https://juju.is/docs/sdk/a-charms-life',) },
        { suffix: '-relation-departed', description: withReference('`relation-departed` is a "teardown" event, emitted when a remote unit departs a relation. This event is the exact inverse of `relation-joined`.', 'https://juju.is/docs/sdk/relation-name-relation-departed-event', 'https://juju.is/docs/sdk/integration', 'https://juju.is/docs/sdk/a-charms-life',) },
        { suffix: '-relation-joined', description: withReference('`relation-joined` is emitted when a unit joins in an existing relation. The unit will be a local one in the case of peer relations, a remote one otherwise.', 'https://juju.is/docs/sdk/relation-name-relation-joined-event', 'https://juju.is/docs/sdk/integration', 'https://juju.is/docs/sdk/a-charms-life',) },
    ].map(({ suffix, description }) => {
        const name = endpoint.name + suffix;
        const symbol = toValidSymbol(name);
        return {
            name,
            symbol,
            preferredHandlerSymbol: '_on_' + symbol,
            description,
        };
    });
};

const CHARM_STORAGE_EVENTS_SUFFIX = [
    `_storage_attached`,
    `_storage_detaching`,
];

const CHARM_CONTAINER_EVENT_SUFFIX = [
    '_pebble_ready',
];

const CHARM_ACTION_EVENT_TEMPLATE = (action: CharmAction): CharmEvent[] => {
    return [
        {
            name: `${action.name}-action`,
            symbol: `${action.symbol}_action`,
            preferredHandlerSymbol: `_on_${action.symbol}_action`,
            description: (action.description ? action.description + '\n\n' : '') + `Fired when \`${action.name}\` action is called.`,
        }
    ];
};

export function emptyActions() {
    return { actions: [], problems: [] };
}

export function emptyConfig() {
    return { parameters: [], problems: [] };
}

export class Charm {
    private _config: CharmConfig = emptyConfig();
    private _configMap = new Map<string, CharmConfigParameter>();

    private _actions: CharmActions = emptyActions();
    private _eventSymbolMap = new Map<string, CharmEvent>();

    private _events: CharmEvent[] = [];
    private _src: CharmSourceCode = new CharmSourceCode({});

    constructor() { }

    get config(): CharmConfig {
        return this._config;
    }

    getConfigParameterByName(name: string): CharmConfigParameter | undefined {
        return this._configMap.get(name);
    }

    get events(): CharmEvent[] {
        return Array.from(this._events);
    }

    getEventBySymbol(symbol: string): CharmEvent | undefined {
        return this._eventSymbolMap.get(symbol);
    }

    get src(): CharmSourceCode {
        return this._src;
    }

    async updateActions(actions: CharmActions) {
        this._actions = actions;
        this._repopulateEvents();
    }

    async updateConfig(config: CharmConfig) {
        this._config = config;
        this._configMap.clear();
        for (const p of this._config.parameters) {
            this._configMap.set(p.name, p);
        }
    }

    async updateSourceCode(src: CharmSourceCode) {
        this._src = src;
    }

    private _repopulateEvents() {
        // TODO include other events
        this._events = [
            ...Array.from(CHARM_LIFECYCLE_EVENTS),
            ...this._actions.actions.map(action => CHARM_ACTION_EVENT_TEMPLATE(action)).flat(1),
        ];

        this._eventSymbolMap.clear();
        for (const e of this._events) {
            this._eventSymbolMap.set(e.symbol, e);
        }
    }
}

