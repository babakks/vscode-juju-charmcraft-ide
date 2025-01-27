import * as actionsYAML from "./actions.yaml";
import * as charmcraftYAML from "./charmcraft.yaml";
import { toValidSymbol } from "./common";
import * as configYAML from "./config.yaml";
import * as metadataYAML from "./metadata.yaml";
import { SourceCode } from "./source";
import * as toxINI from "./tox.ini";

export interface CharmEventBase {
    name: string;
    symbol: string;
    preferredHandlerSymbol: string;
    description?: string;
}

export interface CharmBuiltinEvent extends CharmEventBase {
    source: 'built-in';
}

export type CharmSourcedEventDefinition = 'charmcraft.yaml' | 'metadata.yaml';

export interface CharmSourcedEvent extends CharmEventBase {
    source: 'endpoints/peer' | 'endpoints/requires' | 'endpoints/provides' | 'storage' | 'container';
    definition: CharmSourcedEventDefinition;
}

export type CharmActionEventDefinition = 'charmcraft.yaml' | 'actions.yaml';

export interface CharmActionEvent extends CharmEventBase {
    source: 'action';
    definition: CharmActionEventDefinition;
    sourceActionName: string;
}

export type CharmEvent = CharmBuiltinEvent | CharmSourcedEvent | CharmActionEvent;

export type CharmActionDefinition = 'charmcraft.yaml' | 'actions.yaml';

export interface CharmAction {
    name: string;
    definition: CharmActionDefinition;
    description?: string;
}

export type CharmConfigOptionDefinition = 'charmcraft.yaml' | 'config.yaml';

export interface CharmConfigOptionBase {
    name: string;
    definition: CharmConfigOptionDefinition;
    description?: string;
}

export interface CharmUntypedConfigOption extends CharmConfigOptionBase {
    type: undefined;
    default?: string | number | boolean;
}

export interface CharmStringConfigOption extends CharmConfigOptionBase {
    type: 'string';
    default?: string;
}

export interface CharmIntegerConfigOption extends CharmConfigOptionBase {
    type: 'int';
    default?: number;
}

export interface CharmFloatConfigOption extends CharmConfigOptionBase {
    type: 'float';
    default?: number;
}

export interface CharmBooleanConfigOption extends CharmConfigOptionBase {
    type: 'boolean';
    default?: boolean;
}

export interface CharmSecretConfigOption extends CharmConfigOptionBase {
    type: 'secret';
    default?: string;
}

export type CharmConfigOption =
    CharmUntypedConfigOption
    | CharmStringConfigOption
    | CharmIntegerConfigOption
    | CharmFloatConfigOption
    | CharmBooleanConfigOption
    | CharmSecretConfigOption;

const CHARM_LIFECYCLE_EVENTS: CharmBuiltinEvent[] = [
    Object.freeze({ source: 'built-in', name: 'start', symbol: 'start', preferredHandlerSymbol: '_on_start', description: withReference('Fired as soon as the unit initialization is complete.', 'https://juju.is/docs/sdk/start-event', 'https://juju.is/docs/sdk/a-charms-life',) }),
    Object.freeze({ source: 'built-in', name: 'config-changed', symbol: 'config_changed', preferredHandlerSymbol: '_on_config_changed', description: withReference('Fired whenever the cloud admin changes the charm configuration *.', 'https://juju.is/docs/sdk/config-changed-event', 'https://juju.is/docs/sdk/a-charms-life',) }),
    Object.freeze({ source: 'built-in', name: 'install', symbol: 'install', preferredHandlerSymbol: '_on_install', description: withReference('Fired when juju is done provisioning the unit.', 'https://juju.is/docs/sdk/install-event', 'https://juju.is/docs/sdk/a-charms-life',) }),
    Object.freeze({ source: 'built-in', name: 'leader-elected', symbol: 'leader_elected', preferredHandlerSymbol: '_on_leader_elected', description: withReference('Fired on the new leader when juju elects one.', 'https://juju.is/docs/sdk/leader-elected-event', 'https://juju.is/docs/sdk/a-charms-life',) }),
    Object.freeze({ source: 'built-in', name: 'leader-settings-changed', symbol: 'leader_settings_changed', preferredHandlerSymbol: '_on_leader_settings_changed', description: withReference('Fired on all follower units when a new leader is chosen.', 'https://juju.is/docs/sdk/leader-settings-changed-event', 'https://juju.is/docs/sdk/a-charms-life',) }),
    Object.freeze({ source: 'built-in', name: 'pre-series-upgrade', symbol: 'pre_series_upgrade', preferredHandlerSymbol: '_on_pre_series_upgrade', description: withReference('Fired before the series upgrade takes place.', 'https://juju.is/docs/sdk/pre-series-upgrade-event', 'https://juju.is/docs/sdk/a-charms-life',) }),
    Object.freeze({ source: 'built-in', name: 'post-series-upgrade', symbol: 'post_series_upgrade', preferredHandlerSymbol: '_on_post_series_upgrade', description: withReference('Fired after the series upgrade has taken place.', 'https://juju.is/docs/sdk/post-series-upgrade-event', 'https://juju.is/docs/sdk/a-charms-life',) }),
    Object.freeze({ source: 'built-in', name: 'stop', symbol: 'stop', preferredHandlerSymbol: '_on_stop', description: withReference('Fired before the unit begins deprovisioning.', 'https://juju.is/docs/sdk/stop-event', 'https://juju.is/docs/sdk/a-charms-life',) }),
    Object.freeze({ source: 'built-in', name: 'remove', symbol: 'remove', preferredHandlerSymbol: '_on_remove', description: withReference('Fired just before the unit is deprovisioned.', 'https://juju.is/docs/sdk/remove-event', 'https://juju.is/docs/sdk/a-charms-life',) }),
    Object.freeze({ source: 'built-in', name: 'update-status', symbol: 'update_status', preferredHandlerSymbol: '_on_update_status', description: withReference('Fired automatically at regular intervals by juju.', 'https://juju.is/docs/sdk/update-status-event', 'https://juju.is/docs/sdk/a-charms-life',) }),
    Object.freeze({ source: 'built-in', name: 'upgrade-charm', symbol: 'upgrade_charm', preferredHandlerSymbol: '_on_upgrade_charm', description: withReference('Fired when the cloud admin upgrades the charm.', 'https://juju.is/docs/sdk/upgrade-charm-event', 'https://juju.is/docs/sdk/a-charms-life',) }),
    Object.freeze({ source: 'built-in', name: 'collect-metrics', symbol: 'collect_metrics', preferredHandlerSymbol: '_on_collect_metrics', description: withReference('(deprecated, will be removed soon)', 'https://juju.is/docs/sdk/collect-metrics-event', 'https://juju.is/docs/sdk/a-charms-life',) }),
];

const CHARM_SECRET_EVENTS: CharmEvent[] = [
    Object.freeze({ source: 'built-in', name: 'secret-changed', symbol: 'secret_changed', preferredHandlerSymbol: '_on_secret_changed', description: withReference('The `secret-changed` event is fired on all units observing a secret after the owner of a secret has published a new revision for it.', 'https://juju.is/docs/sdk/event-secret-changed', 'https://juju.is/docs/sdk/a-charms-life',) }),
    Object.freeze({ source: 'built-in', name: 'secret-expired', symbol: 'secret_expired', preferredHandlerSymbol: '_on_secret_expired', description: withReference('If a secret was added with the expire argument set to some future time, when that time elapses, Juju will notify the owner charm that the expiration time has been reached by firing a `secret-expired` event on the owner unit.', 'https://juju.is/docs/sdk/event-secret-expired', 'https://juju.is/docs/sdk/a-charms-life',) }),
    Object.freeze({ source: 'built-in', name: 'secret-remove', symbol: 'secret_remove', preferredHandlerSymbol: '_on_secret_remove', description: withReference('The `secret-remove` event is fired on the owner of a secret when either:\n  - All observers tracking a now-outdated revision have updated to tracking a newer one, so the old revision can be removed.\n  - No observer is tracking an intermediate revision, and a newer one has already been created. So there is a orphaned revision which no observer will ever be able to peek or update to, because there is already a newer one the observer would get instead.', 'https://juju.is/docs/sdk/event-secret-remove', 'https://juju.is/docs/sdk/a-charms-life',) }),
    Object.freeze({ source: 'built-in', name: 'secret-rotate', symbol: 'secret_rotate', preferredHandlerSymbol: '_on_secret_rotate', description: withReference('The `secret-rotate` event is fired on the owner of a secret every time the rotation period elapses (and the event will keep firing until the owner rotates the secret).', 'https://juju.is/docs/sdk/event-secret-rotate', 'https://juju.is/docs/sdk/a-charms-life',) }),
];

export class Charm {
    private _charmcraftYAML: charmcraftYAML.CharmCharmcraft | undefined;
    private _configYAML: configYAML.CharmConfig | undefined;
    private _actionsYAML: actionsYAML.CharmActions | undefined;
    private _metadataYAML: metadataYAML.CharmMetadata | undefined;
    private _toxINI: toxINI.CharmToxConfig | undefined;

    private _events: CharmEvent[] = [];
    private _eventMap = new Map<string, CharmEvent>();
    private _eventSymbolMap = new Map<string, CharmEvent>();
    private _actions: CharmAction[] = [];
    private _actionMap = new Map<string, CharmAction>();
    private _configOptions: CharmConfigOption[] = [];
    private _configOptionMap = new Map<string, CharmConfigOption>();

    private _sourceCode = new SourceCode({});

    constructor() { }

    /**
     * Represents information stored in the charm's `config.yaml` file.
     * 
     * Note that the recommended reference for charm configurations is the
     * `charmcraft.yaml` file.
     */
    get configYAML(): configYAML.CharmConfig | undefined {
        return this._configYAML;
    }

    /**
     * Represents information stored in the charm's `actions.yaml` file.
     * 
     * Note that the recommended reference for charm actions is the
     * `charmcraft.yaml` file.
     */
    get actionsYAML(): actionsYAML.CharmActions | undefined {
        return this._actionsYAML;
    }

    /**
     * Array of charm events. Note that the array contains events sourced in
     * both `charmcraft.yaml`, `metadata.yaml`, and `actions.yaml`, so duplicate
     * events may exist.
     * 
     * To look for a specific event, {@link getEventBySymbol} or
     * {@link getEventByName} should be used.
     */
    get events(): CharmEvent[] {
        return this._events;
    }

    /**
     * Returns the event with the given name, if any.
     * 
     * Note that, if there are two events with the same name but different
     * definition sources (e.g., the same peers/requires/provides endpoint
     * defined in both `charmcraft.yaml` and `metadata.yaml`) the one in
     * `charmcraft.yaml` will be returned. Another example is the *action*
     * events defined in both `charmcraft.yaml` and `actions.yaml`.
     */
    getEventByName(name: string): CharmEvent | undefined {
        return this._eventMap.get(name);
    }

    /**
     * Returns the event with the given symbol, if any.
     * 
     * Note that, if there are two events with the same name but different
     * definition sources (e.g., the same peers/requires/provides endpoint
     * defined in both `charmcraft.yaml` and `metadata.yaml`) the one in
     * `charmcraft.yaml` will be returned. Another example is the *action*
     * events defined in both `charmcraft.yaml` and `actions.yaml`.
     */
    getEventBySymbol(symbol: string): CharmEvent | undefined {
        return this._eventSymbolMap.get(symbol);
    }

    /**
     * Array of charm actions. Note that the array contains actions defined in
     * both `charmcraft.yaml` and `actions.yaml`, so duplicate options may
     * exist.
     */
    get actions(): CharmAction[] {
        return this._actions;
    }

    /**
     * Returns the action with the given name, if any.
     * 
     * Note that, if there are two actions with the same name but defined in
     * both `charmcraft.yaml` and `actions.yaml`, the one in `charmcraft.yaml`
     * will be returned.
     */
    getActionByName(name: string): CharmAction | undefined {
        return this._actionMap.get(name);
    }

    /**
     * Array of charm configuration options. Note that the array contains
     * options defined in both `charmcraft.yaml` and `config.yaml`, so duplicate
     * options may exist.
     */
    get configOptions(): CharmConfigOption[] {
        return this._configOptions;
    }

    /**
     * Returns the configuration option with the given name, if any.
     * 
     * Note that, if there are two configuration options with the same name but
     * defined in both `charmcraft.yaml` and `config.yaml`, the one in
     * `charmcraft.yaml` will be returned.
     */
    getConfigOptionByName(name: string): CharmConfigOption | undefined {
        return this._configOptionMap.get(name);
    }

    /**
     * Represents information stored in the charm's `metadata.yaml` file.
     * 
     * Note that the recommended reference for charm metadata is the
     * `charmcraft.yaml`.
     */
    get metadataYAML(): metadataYAML.CharmMetadata | undefined {
        return this._metadataYAML;
    }

    /**
     * Represents information stored in the charm's `charmcraft.yaml` file.
     */
    get charmcraftYAML(): charmcraftYAML.CharmCharmcraft | undefined {
        return this._charmcraftYAML;
    }

    /**
     * Represents information stored in the charm's `tox.ini` file.
     */
    get toxINI(): toxINI.CharmToxConfig | undefined {
        return this._toxINI;
    }

    get sourceCode(): SourceCode {
        return this._sourceCode;
    }

    async updateActionsYAML(actions: actionsYAML.CharmActions | undefined) {
        this._actionsYAML = actions;
        this._repopulateEvents();
        this._repopulateActions();
    }

    async updateConfigYAML(config: configYAML.CharmConfig | undefined) {
        this._configYAML = config;
        this._repopulateConfigOptions();
    }

    async updateMetadataYAML(metadata: metadataYAML.CharmMetadata | undefined) {
        this._metadataYAML = metadata;
        this._repopulateEvents();
    }

    async updateCharmcraftYAML(charmcraft: charmcraftYAML.CharmCharmcraft | undefined) {
        this._charmcraftYAML = charmcraft;
        this._repopulateEvents();
        this._repopulateActions();
        this._repopulateConfigOptions();
    }

    async updateToxINI(toxINI: toxINI.CharmToxConfig | undefined) {
        this._toxINI = toxINI;
    }

    async updateSourceCode(sourceCode: SourceCode) {
        this._sourceCode = sourceCode;
    }

    private _repopulateEvents() {
        this._events = [
            ...Array.from(CHARM_LIFECYCLE_EVENTS),
            ...Array.from(CHARM_SECRET_EVENTS),

            // From Charmcraft 3, a single `charmcraft.yaml` acts as a
            // consolidated source of information, deprecating separate
            // `actions.yaml`, `metadata.yaml`, and `config.yaml`.
            //
            // For backward compatibility, we have to keep supporting the old
            // style. That is why below events are extracted from both
            // `actions.yaml`/`metadata.yaml` and `charmcraft.yaml` information.

            ...Object.entries(this._actionsYAML?.actions?.entries ?? {}).filter(([, action]) => action.value).map(([, action]) => renderCharmActionEvents(action.value!, 'actions.yaml')).flat(1),
            ...Object.entries(this._metadataYAML?.storage?.entries ?? {}).filter(([, storage]) => storage.value).map(([, storage]) => renderCharmStorageEvents(storage.value!, 'metadata.yaml')).flat(1),
            ...Object.entries(this._metadataYAML?.containers?.entries ?? {}).filter(([, container]) => container.value).map(([, container]) => renderCharmContainerEvents(container.value!, 'metadata.yaml')).flat(1),
            ...Object.entries(this._metadataYAML?.peers?.entries ?? {}).filter(([, endpoint]) => endpoint.value).map(([, endpoint]) => renderCharmRelationEvents(endpoint.value!, 'endpoints/peer', 'metadata.yaml')).flat(1),
            ...Object.entries(this._metadataYAML?.provides?.entries ?? {}).filter(([, endpoint]) => endpoint.value).map(([, endpoint]) => renderCharmRelationEvents(endpoint.value!, 'endpoints/provides', 'metadata.yaml')).flat(1),
            ...Object.entries(this._metadataYAML?.requires?.entries ?? {}).filter(([, endpoint]) => endpoint.value).map(([, endpoint]) => renderCharmRelationEvents(endpoint.value!, 'endpoints/requires', 'metadata.yaml')).flat(1),

            // Events related to information in `charmcraft.yaml` are defined
            // after all those related to `metadata.yaml` or `actions.yaml` in
            // order to override duplicate names (see the map creation loop
            // below).
            ...Object.entries(this._charmcraftYAML?.actions?.entries ?? {}).filter(([, action]) => action.value).map(([, action]) => renderCharmActionEvents(action.value!, 'charmcraft.yaml')).flat(1),
            ...Object.entries(this._charmcraftYAML?.storage?.entries ?? {}).filter(([, storage]) => storage.value).map(([, storage]) => renderCharmStorageEvents(storage.value!, 'charmcraft.yaml')).flat(1),
            ...Object.entries(this._charmcraftYAML?.containers?.entries ?? {}).filter(([, container]) => container.value).map(([, container]) => renderCharmContainerEvents(container.value!, 'charmcraft.yaml')).flat(1),
            ...Object.entries(this._charmcraftYAML?.peers?.entries ?? {}).filter(([, endpoint]) => endpoint.value).map(([, endpoint]) => renderCharmRelationEvents(endpoint.value!, 'endpoints/peer', 'charmcraft.yaml')).flat(1),
            ...Object.entries(this._charmcraftYAML?.provides?.entries ?? {}).filter(([, endpoint]) => endpoint.value).map(([, endpoint]) => renderCharmRelationEvents(endpoint.value!, 'endpoints/provides', 'charmcraft.yaml')).flat(1),
            ...Object.entries(this._charmcraftYAML?.requires?.entries ?? {}).filter(([, endpoint]) => endpoint.value).map(([, endpoint]) => renderCharmRelationEvents(endpoint.value!, 'endpoints/requires', 'charmcraft.yaml')).flat(1),
        ];

        this._eventSymbolMap.clear();
        this._eventMap.clear();
        for (const e of this._events) {
            this._eventMap.set(e.name, e);
            this._eventSymbolMap.set(e.symbol, e);
        }
    }

    private _repopulateActions() {
        this._actions = [
            ...Object.entries(this.actionsYAML?.actions?.entries ?? {}).map(([, action]) => createAction(action.value, 'actions.yaml')).filter(x => !!x).map(x => x!),
            // Actions defined in `charmcraft.yaml` are added after all those
            // defined in `actions.yaml` in order to override duplicate names
            // (see the map creation loop below).
            ...Object.entries(this._charmcraftYAML?.actions?.entries ?? {}).map(([, action]) => createAction(action.value, 'charmcraft.yaml')).filter(x => !!x).map(x => x!),
        ];

        this._actionMap.clear();
        for (const a of this._actions) {
            this._actionMap.set(a.name, a);
        }

        function createAction(option: charmcraftYAML.CharmAction | actionsYAML.CharmAction | undefined, definition: CharmActionDefinition): CharmAction | undefined {
            return option ? {
                name: option.name,
                definition,
                description: option.description?.value,
            } : undefined;
        }
    }

    private _repopulateConfigOptions() {
        this._configOptions = [
            ...Object.entries(this._configYAML?.parameters?.entries ?? {}).map(([, option]) => createConfigOption(option.value, 'config.yaml')).filter(x => !!x).map(x => x!),
            // Options related to information in `charmcraft.yaml` are added
            // after all those related to `config.yaml` in order to override
            // duplicate names (see the map creation loop below).
            ...Object.entries(this._charmcraftYAML?.config?.value?.options?.entries ?? {}).map(([, option]) => createConfigOption(option.value, 'charmcraft.yaml')).filter(x => !!x).map(x => x!),
        ];

        this._configOptionMap.clear();
        for (const o of this._configOptions) {
            this._configOptionMap.set(o.name, o);
        }

        function createConfigOption(option: charmcraftYAML.CharmConfigOption | configYAML.CharmConfigParameter | undefined, definition: CharmConfigOptionDefinition): CharmConfigOption | undefined {
            if (!option) {
                return undefined;
            }

            const base: CharmConfigOptionBase = {
                name: option.name,
                definition,
                description: option.description?.value,
            };

            if (option?.type?.value === undefined) {
                return {
                    ...base,
                    type: undefined,
                    default: option.default?.value,
                };
            }

            switch (option.type.value) {
                case 'string':
                    return {
                        ...base,
                        type: 'string',
                        default: stringOrUndefined(option.default?.value),
                    };
                case 'secret':
                    return {
                        ...base,
                        type: 'secret',
                        default: stringOrUndefined(option.default?.value),
                    };
                case 'boolean':
                    return {
                        ...base,
                        type: 'boolean',
                        default: booleanOrUndefined(option.default?.value),
                    };
                case 'int':
                    return {
                        ...base,
                        type: 'int',
                        default: integerOrUndefined(option.default?.value),
                    };
                case 'float':
                    return {
                        ...base,
                        type: 'float',
                        default: numberOrUndefined(option.default?.value),
                    };
                default:
                    return undefined;
            }
        }

        function stringOrUndefined<T>(v: any): string | undefined {
            return typeof v === 'string' ? v : undefined;
        }

        function booleanOrUndefined<T>(v: any): boolean | undefined {
            return typeof v === 'boolean' ? v : undefined;
        }

        function numberOrUndefined<T>(v: any): number | undefined {
            return typeof v === 'number' ? v : undefined;
        }

        function integerOrUndefined<T>(v: any): number | undefined {
            return typeof v === 'number' && Number.isInteger(v) ? v : undefined;
        }
    }
}

function withReference(text: string, ...urls: string[]): string {
    return `${text}\n\n*Reference(s):*\n${urls.map(x => `  - ${x}`).join('\n')}`;
}

function renderCharmRelationEvents(endpoint: metadataYAML.CharmEndpoint | charmcraftYAML.CharmEndpoint, source: 'endpoints/peer' | 'endpoints/requires' | 'endpoints/provides', definition: CharmSourcedEventDefinition): CharmSourcedEvent[] {
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
            source,
            symbol,
            preferredHandlerSymbol: '_on_' + symbol,
            description,
            definition,
        };
    });
};

function renderCharmStorageEvents(storage: metadataYAML.CharmStorage | charmcraftYAML.CharmStorage, definition: CharmSourcedEventDefinition): CharmSourcedEvent[] {
    return [
        { suffix: '-storage-attached', description: withReference('The event informs a charm that a storage volume has been attached, and is ready to interact with.', 'https://juju.is/docs/sdk/storage-name-storage-attached-event', 'https://juju.is/docs/sdk/a-charms-life',) },
        { suffix: '-storage-detaching', description: withReference('The event allows a charm to perform cleanup tasks on a storage volume before that storage is dismounted and possibly destroyed.', 'https://juju.is/docs/sdk/storage-name-storage-detaching-event', 'https://juju.is/docs/sdk/a-charms-life',) },
    ].map(({ suffix, description }) => {
        const name = storage.name + suffix;
        const symbol = toValidSymbol(name);
        return {
            name,
            source: 'storage',
            symbol,
            preferredHandlerSymbol: '_on_' + symbol,
            description,
            definition,
        };
    });
};

function renderCharmContainerEvents(container: metadataYAML.CharmContainer | charmcraftYAML.CharmContainer, definition: CharmSourcedEventDefinition): CharmEvent[] {
    return [
        { suffix: '-pebble-ready', description: withReference('The event is emitted once the Pebble sidecar container has started and a socket is available.', 'https://juju.is/docs/sdk/container-name-pebble-ready-event', 'https://juju.is/docs/sdk/a-charms-life',) },
    ].map(({ suffix, description }) => {
        const name = container.name + suffix;
        const symbol = toValidSymbol(name);
        return {
            name,
            source: 'container',
            symbol,
            preferredHandlerSymbol: '_on_' + symbol,
            description,
            definition,
        };
    });
};

function renderCharmActionEvents(action: actionsYAML.CharmAction | charmcraftYAML.CharmAction, definition: CharmActionEventDefinition): CharmActionEvent[] {
    return [
        {
            source: 'action',
            name: `${action.name}-action`,
            symbol: `${action.symbol}_action`,
            sourceActionName: action.name,
            preferredHandlerSymbol: `_on_${action.symbol}_action`,
            description: (action.description?.value !== undefined ? action.description.value + '\n\n' : '') + `Fired when \`${action.name}\` action is called.`,
            definition,
        }
    ];
};
