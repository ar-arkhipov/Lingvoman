const request = require('supertest');
const { expect } = require('chai');
let app;
let UiTran;
let UiReservedTran;
const { createTestUser, loginAndGetToken } = require('../utils/auth');
const languageService = require('../../libs/languageService');

describe('UI Translations API (integration)', function () {
  this.timeout(20000);

  let token;

  before(async () => {
    // Lazy-load to ensure env from global setup is applied
    ({ app } = require('../../src/server'));
    ({ UiTran, UiReservedTran } = require('../../libs/mongoose'));
    await createTestUser();
    token = await loginAndGetToken();
  });

  beforeEach(async () => {
    await UiTran.deleteMany({});
    await UiReservedTran.deleteMany({});
  });

  async function seedMultiLangProject(projectID) {
    await UiTran.deleteMany({ projectID });
    await UiTran.create({
      projectID,
      projectAlphaId: `proj-${projectID}`,
      locale: 'en',
      translations: {
        common: { hello: 'Hello', bye: 'Goodbye' },
        home: { title: 'Home' }
      }
    });
    await UiTran.create({
      projectID,
      projectAlphaId: `proj-${projectID}`,
      locale: 'fr',
      translations: {
        common: { hello: 'Bonjour' }
      }
    });
    await UiTran.create({
      projectID,
      projectAlphaId: `proj-${projectID}`,
      locale: 'de',
      translations: {
        common: { hello: 'Hallo', bye: 'Tschüss' },
        home: { title: 'Startseite' }
      }
    });
  }

  it('should create a new translation document (project + locale)', async () => {
    const payload = {
      projectID: 101,
      projectAlphaId: 'proj-101',
      locale: 'en',
      translations: { common: { hello: 'Hello' } }
    };

    const res = await request(app)
      .put('/api/uitranslate/item')
      .set('x-access-token', token)
      .send(payload);

    expect(res.status).to.equal(201);
    expect(res.body).to.include({ projectID: 101, locale: 'en' });
  });

  it('should add a section key via merge endpoint', async () => {
    // Seed a base EN doc
    await UiTran.create({ projectID: 201, projectAlphaId: 'proj-201', locale: 'en', translations: { a: {} } });

    const res = await request(app)
      .post('/api/uitranslate/merge')
      .set('x-access-token', token)
      .send({
        projectID: 201,
        locale: 'en',
        translations: { a: { welcome: 'Welcome' } }
      });

    expect(res.status).to.equal(200);
    const doc = await UiTran.findOne({ projectID: 201, locale: 'en' });

    expect(doc.translations.a.welcome).to.equal('Welcome');
  });

  it('should update key value using merge endpoint (and create backup)', async () => {
    await UiTran.create({ projectID: 301, projectAlphaId: 'proj-301', locale: 'en', translations: { sect: { k: 'v1' } } });

    const res = await request(app)
      .post('/api/uitranslate/merge')
      .set('x-access-token', token)
      .send({ projectID: 301, locale: 'en', translations: { sect: { k: 'v2' } } });

    expect(res.status).to.equal(200);
    const doc = await UiTran.findOne({ projectID: 301, locale: 'en' });

    expect(doc.translations.sect.k).to.equal('v2');

    const backup = await UiReservedTran.findOne({ projectID: 301, locale: 'en' });

    expect(backup).to.exist;
  });

  it('should remove a section key via sections endpoint', async () => {
    await UiTran.create({ projectID: 401, projectAlphaId: 'proj-401', locale: 'en', translations: { a: { x: '1', y: '2' } } });

    // Set key to undefined will be ignored; set to empty string allowed per DTO; use direct updateTranslations to remove
    const res = await request(app)
      .post('/api/uitranslate/item')
      .set('x-access-token', token)
      .send({ projectID: 401, locale: 'en', translations: { a: { x: '1' } } });

    expect(res.status).to.equal(200);
    const doc = await UiTran.findOne({ projectID: 401, locale: 'en' });

    expect(doc.translations.a).to.deep.equal({ x: '1' });
  });

  it('should delete translation document and allow restore from backup', async () => {
    await UiTran.create({ projectID: 501, projectAlphaId: 'proj-501', locale: 'en', translations: { s: { k: 'v' } } });

    // backup implicitly occurs in deleteTranslation
    const delRes = await request(app)
      .delete('/api/uitranslate/item')
      .set('x-access-token', token)
      .query({ projectID: 501, locale: 'en' });

    expect(delRes.status).to.equal(200);

    const afterDelete = await UiTran.findOne({ projectID: 501, locale: 'en' });

    expect(afterDelete).to.equal(null);

    // restore
    const restoreRes = await request(app)
      .post('/api/uitranslate/backup')
      .set('x-access-token', token)
      .send({ projectID: 501, locale: 'en' });

    expect(restoreRes.status).to.equal(200);

    const restored = await UiTran.findOne({ projectID: 501, locale: 'en' });

    expect(restored).to.exist;
    expect(restored.translations.s.k).to.equal('v');
  });

  it('[languages] should report available languages and source language', async () => {
    const projectID = 601;

    await seedMultiLangProject(projectID);

    const res = await request(app)
      .get(`/api/uitranslate/languages/${projectID}`)
      .set('x-access-token', token);

    expect(res.status).to.equal(200);
    expect(res.body).to.include({ projectID });
    expect(res.body.availableLanguages.sort()).to.deep.equal(['de', 'en', 'fr']);
    expect(res.body.sourceLanguage).to.equal('en');
    expect(res.body.languageDetails.en.totalKeys).to.equal(3);
  });

  it('[languages] should fetch translation items by locale', async () => {
    const projectID = 601;

    await seedMultiLangProject(projectID);

    const resEn = await request(app)
      .get('/api/uitranslate/item')
      .set('x-access-token', token)
      .query({ projectID, locale: 'en' });

    expect(resEn.status).to.equal(200);
    expect(resEn.body.locale).to.equal('en');
    expect(resEn.body.translations.common.hello).to.equal('Hello');

    const resFr = await request(app)
      .get('/api/uitranslate/item')
      .set('x-access-token', token)
      .query({ projectID, locale: 'fr' });

    expect(resFr.status).to.equal(200);
    expect(resFr.body.locale).to.equal('fr');
    expect(resFr.body.translations.common.hello).to.equal('Bonjour');

    const resDe = await request(app)
      .get('/api/uitranslate/item')
      .set('x-access-token', token)
      .query({ projectID, locale: 'de' });

    expect(resDe.status).to.equal(200);
    expect(resDe.body.locale).to.equal('de');
    expect(resDe.body.translations.home.title).to.equal('Startseite');
  });

  it('[languages] should provide unsync info marking FR as needing sync and DE as synced', async () => {
    const projectID = 601;

    await seedMultiLangProject(projectID);

    const res = await request(app)
      .get(`/api/uitranslate/unsync-info/${projectID}`)
      .set('x-access-token', token)
      .query({ sourceLocale: 'en' });

    expect(res.status).to.equal(200);
    const { targetLanguages, unsyncedLanguages } = res.body;

    expect(unsyncedLanguages).to.include('fr');
    expect(targetLanguages.fr.totalMissingKeys).to.be.greaterThan(0);
    expect(targetLanguages.de.totalMissingKeys).to.equal(0);
  });

  it('[languages] should detect changed English base hash and mark target as changed + missing new keys', async () => {
    const pid = 701;

    // Seed EN and FR fully in sync
    await UiTran.create({
      projectID: pid,
      projectAlphaId: 'proj-701',
      locale: 'en',
      translations: { sect: { hello: 'Hello', bye: 'Goodbye' } }
    });
    await UiTran.create({
      projectID: pid,
      projectAlphaId: 'proj-701',
      locale: 'fr',
      translations: { sect: { hello: 'Bonjour', bye: 'Au revoir' } }
    });

    const enDocBefore = await UiTran.findOne({ projectID: pid, locale: 'en' });

    await UiTran.updateOne(
      { projectID: pid, locale: 'fr' },
      { $set: { baseHashMap: enDocBefore.baseHashMap } }
    );

    const mergeRes = await request(app)
      .post('/api/uitranslate/merge')
      .set('x-access-token', token)
      .send({ projectID: pid, locale: 'en', translations: { sect: { hello: 'Hello there', greet: 'Greetings' } } });

    expect(mergeRes.status).to.equal(200);

    const res = await request(app)
      .get(`/api/uitranslate/unsync-info/${pid}`)
      .set('x-access-token', token)
      .query({ sourceLocale: 'en' });

    expect(res.status).to.equal(200);
    const { targetLanguages, unsyncedLanguages } = res.body;

    expect(unsyncedLanguages).to.include('fr');
    expect(targetLanguages.fr.changedSections).to.include('sect');
    expect(targetLanguages.fr.changedKeys.sect).to.include('hello');
    expect(targetLanguages.fr.missingKeys.sect).to.include('greet');
  });

  it('[sync] should translate missing/changed keys and snapshot EN baseHashMap to target', async () => {
    const pid = 801;

    // Seed EN with two keys and FR missing one
    await UiTran.create({
      projectID: pid,
      projectAlphaId: 'proj-801',
      locale: 'en',
      translations: { sect: { hello: 'Hello' }, home: { title: 'Home' } }
    });
    await UiTran.create({
      projectID: pid,
      projectAlphaId: 'proj-801',
      locale: 'fr',
      translations: { sect: { hello: 'Bonjour' } }
    });

    // Stub translator to avoid external OpenAI calls
    const flexibleTranslationSync = require('../../libs/flexibleTranslationSync');

    flexibleTranslationSync.openaiService = {
      translateSection: async (payload, targetLocale) => {
        const out = {};

        Object.keys(payload).forEach((k) => {
          out[k] = `[${targetLocale}] ${payload[k]}`;
        });

        return out;
      }
    };

    // Start sync job EN -> FR
    const startRes = await request(app)
      .post('/api/uitranslate/sync-flexible')
      .set('x-access-token', token)
      .send({ projectID: pid, projectAlphaId: 'proj-801', targetLocale: 'fr', sourceLocale: 'en' });

    expect(startRes.status).to.equal(202);
    const jobId = startRes.body.jobId;

    // Poll until completed
    let status = null;

    for (let i = 0; i < 40; i++) {
      const pr = await request(app)
        .get(`/api/uitranslate/sync-progress/${jobId}`)
        .set('x-access-token', token);

      expect(pr.status).to.equal(200);
      status = pr.body.status;

      if (status === 'completed' || status === 'failed') break;

      await new Promise((r) => setTimeout(r, 25));
    }

    expect(status).to.equal('completed');

    const enDoc = await UiTran.findOne({ projectID: pid, locale: 'en' });
    const frDoc = await UiTran.findOne({ projectID: pid, locale: 'fr' });

    expect(frDoc.translations.home.title).to.equal('[fr] Home');
    // baseHashMap of FR should match EN's computed base after sync snapshot
    const expectedBase = languageService.buildBaseHashMap(enDoc.translations || {});

    expect(JSON.stringify(frDoc.baseHashMap)).to.equal(JSON.stringify(expectedBase));

    // Verify unsync reports no issues for FR now
    const unsync = await request(app)
      .get(`/api/uitranslate/unsync-info/${pid}`)
      .set('x-access-token', token)
      .query({ sourceLocale: 'en' });

    expect(unsync.status).to.equal(200);
    const { targetLanguages, unsyncedLanguages } = unsync.body;

    expect(unsyncedLanguages).to.not.include('fr');
    expect(targetLanguages.fr.totalMissingKeys).to.equal(0);
    expect(targetLanguages.fr.totalChangedKeys || 0).to.equal(0);
  });
    it('[sync] should remove extra sections and keys from target during sync', async () => {
        const pid = 901;

        // Seed EN with a single key
        await UiTran.create({
            projectID: pid,
            projectAlphaId: 'proj-901',
            locale: 'en',
            translations: { sect: { a: 'Hello' } }
        });

        // Seed FR with the valid key plus extra section/key
        await UiTran.create({
            projectID: pid,
            projectAlphaId: 'proj-901',
            locale: 'fr',
            translations: { sect: { a: 'Bonjour', extra: 'EXTRA' }, extraSection: { x: 'EXTRA X' } }
        });

        // Snapshot EN baseHashMap into FR to avoid changed-keys path interfering with this test
        const enDoc = await UiTran.findOne({ projectID: pid, locale: 'en' });
        const expectedBase = languageService.buildBaseHashMap(enDoc.translations || {});

        await UiTran.updateOne(
            { projectID: pid, locale: 'fr' },
            { $set: { baseHashMap: expectedBase } }
        );

        // Stub translator to avoid external OpenAI calls (should not be used in this scenario)
        const flexibleTranslationSync = require('../../libs/flexibleTranslationSync');

        flexibleTranslationSync.openaiService = {
            translateSection: async (payload, targetLocale) => payload
        };

        // Start sync job EN -> FR
        const startRes = await request(app)
            .post('/api/uitranslate/sync-flexible')
            .set('x-access-token', token)
            .send({ projectID: pid, projectAlphaId: 'proj-901', targetLocale: 'fr', sourceLocale: 'en' });

        expect(startRes.status).to.equal(202);
        const jobId = startRes.body.jobId;

        // Poll until completed
        let status = null;
        let result = null;

        for (let i = 0; i < 40; i++) {
            const pr = await request(app)
                .get(`/api/uitranslate/sync-progress/${jobId}`)
                .set('x-access-token', token);

            expect(pr.status).to.equal(200);
            status = pr.body.status;
            result = pr.body.result || null;

            if (status === 'completed' || status === 'failed') break;

            await new Promise((r) => setTimeout(r, 25));
        }

        expect(status).to.equal('completed');

        // FR should no longer have extra section/key

        const frDoc = await UiTran.findOne({ projectID: pid, locale: 'fr' });

        expect(frDoc).to.exist;
        expect(frDoc.translations).to.be.an('object');
        // Always removed
        expect(frDoc.translations).to.not.have.property('extraSection');
        // If sect exists, it should not contain the extra key

        if (frDoc.translations.sect) {
            expect(frDoc.translations.sect).to.not.have.property('extra');
        }

        // Result should report two removed extra keys (sect.extra and extraSection.x)

        expect(result && result.removedExtraKeys).to.equal(2);
    });
});


