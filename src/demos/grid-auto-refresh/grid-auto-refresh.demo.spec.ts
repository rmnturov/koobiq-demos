import { describe, expect, it } from 'vitest';
import { findDemo } from '../demos.registry';
import { filterFromQuery, queryFromFilter } from './incident-filters';
import { DEFAULT_QUERY } from './incident-model';

describe('incident grid integration', () => {
    it('is available from the demo catalog', () => {
        expect(findDemo('grid-auto-refresh')).toBeDefined();
        expect(findDemo('grid-auto-refresh')!.loadComponent).toBeTypeOf('function');
    });
    it('round trips active filter values without losing sorting', () => {
        const query = { ...DEFAULT_QUERY, search: 'vpn', status: 'new' as const, severity: 2 as const, assignee: 'Анна Петрова', period: 'hour' as const };
        expect(queryFromFilter(filterFromQuery(query), query.sort)).toEqual(query);
    });
    it('removing optional pipes removes their constraints', () => {
        const filter = filterFromQuery({ ...DEFAULT_QUERY, status: 'closed' });
        filter.pipes = filter.pipes.filter(pipe => pipe.id !== 'status');
        expect(queryFromFilter(filter, DEFAULT_QUERY.sort).status).toBeNull();
    });
});
