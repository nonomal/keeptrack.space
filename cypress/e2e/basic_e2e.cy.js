/* global cy */

const LOCAL_ADDRESS = '10.0.0.44'; // 'localhost';

describe('Site Initializes', () => {
  beforeEach(() => {
    const port = '8080';
    const url = `http://${LOCAL_ADDRESS}:${port}`;
    cy.visit(url);
  });

  it('should load the page', () => {
    cy.window().its('settingsManager.cruncherReady').should('equal', true);

    let keepTrackApi;
    cy.window()
      .then((win) => {
        keepTrackApi = win.keepTrackApi;
      })
      .then(() => {
        expect(keepTrackApi.getCatalogManager().satData.length).to.be.greaterThan(1000);
      });

    cy.get('#sensor-list-icon').should('be.visible');
    cy.get('#sensor-list-menu').should('not.be.visible');
    cy.get('#sensor-list-icon').click();
    cy.wait(1000);
    cy.get('#sensor-list-menu').should('be.visible');
    cy.get('#sensor-list-icon').click();
    cy.wait(1000);
    cy.get('#sensor-list-menu').should('not.be.visible');

    // sensor-info-icon
    // cy.get('#sensor-info-icon').should('be.visible');
    // cy.get('#sensor-info-menu').should('not.be.visible');
    // cy.get('#sensor-info-icon').click();
    // cy.get('#sensor-info-menu').should('be.visible');
    // cy.get('#sensor-info-icon').click();
    // cy.get('#sensor-info-menu').should('not.be.visible');

    // custom-sensor-icon
    cy.get('#custom-sensor-icon').should('be.visible');
    cy.get('#custom-sensor-menu').should('not.be.visible');
    cy.get('#custom-sensor-icon').click();
    cy.wait(1000);
    cy.get('#custom-sensor-menu').should('be.visible');
    cy.get('#custom-sensor-icon').click();
    cy.wait(1000);
    cy.get('#custom-sensor-menu').should('not.be.visible');

    // menu-watchlist
    cy.get('#menu-watchlist').should('be.visible');
    cy.get('#watchlist-menu').should('not.be.visible');
    cy.get('#menu-watchlist').click();
    cy.wait(1000);
    cy.get('#watchlist-menu').should('be.visible');
    cy.get('#menu-watchlist').click();
    cy.wait(1000);
    cy.get('#watchlist-menu').should('not.be.visible');

    // menu-nextLaunch
    cy.get('#menu-nextLaunch').should('be.visible');
    cy.get('#nextLaunch-menu').should('not.be.visible');
    cy.get('#menu-nextLaunch').click();
    cy.wait(1000);
    cy.get('#nextLaunch-menu').should('be.visible');
    cy.get('#menu-nextLaunch').click();
    cy.wait(1000);
    cy.get('#nextLaunch-menu').should('not.be.visible');

    // menu-find-sat
    cy.get('#menu-find-sat').should('be.visible');
    cy.get('#findByLooks-menu').should('not.be.visible');
    cy.get('#menu-find-sat').click();
    cy.wait(1000);
    cy.get('#findByLooks-menu').should('be.visible');
    cy.get('#menu-find-sat').click();
    cy.wait(1000);
    cy.get('#findByLooks-menu').should('not.be.visible');
  });
});
