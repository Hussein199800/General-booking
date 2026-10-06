import { GOVERNORATES, NOTIFICATION_TEMPLATE_CODES, placeholdersOf } from '@sba/shared';
import { describe, expect, it } from 'vitest';

import { loadSeedEnv } from '../../src/seed/config.js';
import { externalEntities, organizationalUnits } from '../../src/seed/reference-data.js';
import { desiredTemplates, planTemplate, type ActiveTemplate } from '../../src/seed/templates.js';

describe('reference data', () => {
  const units = organizationalUnits();

  it('has one branch council per governorate, all 14', () => {
    const branches = units.filter((unit) => unit.unitType === 'REGIONAL_BRANCH');
    expect(branches).toHaveLength(14);
    expect(branches.map((branch) => branch.governorate)).toEqual([...GOVERNORATES]);
    expect(new Set(branches.map((branch) => branch.nameAr)).size).toBe(14);
  });

  it('seeds the central bodies and only the central Disciplinary Committee (Q10)', () => {
    expect(
      units.filter((unit) => unit.unitType !== 'REGIONAL_BRANCH').map((unit) => unit.code),
    ).toEqual(['GRAND_SYNDIC_OFFICE', 'CENTRAL_SECRETARIAT', 'CENTRAL_DISCIPLINARY_COMMITTEE']);
  });

  it('uses codes the database CHECK accepts and unique names', () => {
    for (const unit of units) expect(unit.code).toMatch(/^[A-Z][A-Z0-9_]*$/);
    expect(new Set(units.map((unit) => unit.code)).size).toBe(units.length);
  });

  it('seeds the Ministry of Justice and the Supreme Judicial Council', () => {
    expect(externalEntities().map((entity) => entity.code)).toEqual([
      'MINISTRY_OF_JUSTICE',
      'SUPREME_JUDICIAL_COUNCIL',
    ]);
  });
});

describe('notification templates', () => {
  it('produces SMS and e-mail for every code, keeping placeholders raw', () => {
    const templates = desiredTemplates();
    expect(templates).toHaveLength(NOTIFICATION_TEMPLATE_CODES.length * 2);
    for (const template of templates) {
      expect(template.subject === null).toBe(template.channel === 'SMS');
      expect(placeholdersOf(template.body).length).toBeGreaterThan(0);
    }
  });

  const desired = { code: 'REQUEST_RECEIVED', channel: 'SMS', subject: null, body: 'v2' } as const;
  const active: ActiveTemplate = { ...desired, id: 't1', version: 1, body: 'v1' };

  it('creates version 1 when nothing exists', () => {
    expect(planTemplate(desired, undefined, 0)).toEqual({ kind: 'create', desired, version: 1 });
  });

  it('leaves identical wording alone', () => {
    expect(planTemplate(desired, { ...active, body: 'v2' }, 1).kind).toBe('unchanged');
  });

  it('supersedes changed wording with a new version instead of editing', () => {
    expect(planTemplate(desired, active, 1)).toEqual({
      kind: 'supersede',
      desired,
      retireId: 't1',
      version: 2,
    });
  });

  it('never reuses a retired version number', () => {
    expect(planTemplate(desired, undefined, 3)).toMatchObject({ kind: 'create', version: 4 });
  });
});

describe('seed configuration', () => {
  const base = { DATABASE_MIGRATION_URL: 'postgresql://localhost/sba' };
  const demo = {
    ...base,
    SEED_DEMO_DATA: 'true',
    SEED_DEMO_PASSWORD: 'long-enough-password',
    MASTER_KEYS_FILE: 'k.json',
    MASTER_KEY_ACTIVE_ID: 'kek-dev-01',
    PII_HMAC_PEPPER_FILE: 'pepper',
  };

  it('defaults to reference data only', () => {
    expect(loadSeedEnv(base).SEED_DEMO_DATA).toBe(false);
  });

  it('refuses demo data in production', () => {
    expect(() => loadSeedEnv({ ...demo, NODE_ENV: 'production' })).toThrow(
      /never be enabled in production/,
    );
  });

  it('refuses a weak demo password', () => {
    expect(() => loadSeedEnv({ ...demo, SEED_DEMO_PASSWORD: 'short' })).toThrow(/at least 12/);
  });

  it('resolves relative secret files from the repository root', () => {
    const env = loadSeedEnv({ ...demo, MASTER_KEYS_FILE: './infra/secrets/master-keys.json' });
    expect(env.MASTER_KEYS_FILE).toMatch(/\/infra\/secrets\/master-keys\.json$/);
    expect(env.MASTER_KEYS_FILE).not.toContain('packages');
  });

  it('requires key material for demo lawyers', () => {
    expect(() => loadSeedEnv({ ...demo, PII_HMAC_PEPPER_FILE: undefined })).toThrow(
      /PII_HMAC_PEPPER_FILE/,
    );
  });
});
