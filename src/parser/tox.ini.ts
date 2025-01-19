import * as ini from 'ini';
import { CharmToxConfig, CharmToxConfigSection } from '../model/tox.ini';

const _TOX_SECTION_PATTERN = /(?<parent>.*):(?<env>[^:]+)$/;
export function parseToxINI(text: string): CharmToxConfig {
    let parsed = {};
    try {
        parsed = ini.parse(text);
    } catch { }

    const result: CharmToxConfig = {
        sections: {},
    };

    for (const [k, v] of Object.entries(parsed)) {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
            const section = parseSection(k, v);
            if (section) {
                result.sections[k] = section;
            }
        }
    }
    return result;

    function parseSection(name: string, v: Object): CharmToxConfigSection | undefined {
        const match = name.match(_TOX_SECTION_PATTERN);
        const result: CharmToxConfigSection = {
            name,
            env: match?.groups!['env'] ?? name,
            parent: match?.groups!['parent'] ?? '',
            /*
             * NOTE the `ini` package does not support multiline values which is common
             * for `description` or `commands` in `tox.ini` file. Therefore, we just
             * use the section names.
             */
        };
        return result;
    }
}
