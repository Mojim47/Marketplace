describe('CORS and CSRF Protection', () => {
  const API_BASE = 'http://localhost:3001';
  const ALLOWED_ORIGIN = 'http://localhost:3000';
  const BLOCKED_ORIGIN = 'https://malicious-site.com';

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
  });

  it('should allow requests from whitelisted origins', () => {
    cy.request({
      method: 'GET',
      url: `${API_BASE}/csrf/token`,
      headers: {
        Origin: ALLOWED_ORIGIN,
      },
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.csrfToken).to.exist;
      expect(response.headers['access-control-allow-origin']).to.eq(ALLOWED_ORIGIN);
    });
  });

  it('should block requests from non-whitelisted origins', () => {
    cy.request({
      method: 'GET',
      url: `${API_BASE}/csrf/token`,
      headers: {
        Origin: BLOCKED_ORIGIN,
      },
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.not.eq(200);
    });
  });

  it('should set secure cookies with SameSite=Strict', () => {
    cy.visit('http://localhost:3000');

    cy.request({
      method: 'GET',
      url: `${API_BASE}/csrf/token`,
      headers: {
        Origin: ALLOWED_ORIGIN,
      },
    }).then((response) => {
      const setCookieHeader = response.headers['set-cookie'];
      expect(setCookieHeader).to.exist;

      const csrfCookie = setCookieHeader.find((cookie) => cookie.includes('csrf-token'));
      expect(csrfCookie).to.include('SameSite=Strict');

      const sessionCookie = setCookieHeader.find((cookie) => cookie.includes('nextgen.sid'));
      expect(sessionCookie).to.include('HttpOnly');
      expect(sessionCookie).to.include('SameSite=Strict');
    });
  });

  it('should enforce CSRF protection on state-changing requests', () => {
    // First get CSRF token
    cy.request({
      method: 'GET',
      url: `${API_BASE}/csrf/token`,
      headers: { Origin: ALLOWED_ORIGIN },
    }).then((tokenResponse) => {
      const csrfToken = tokenResponse.body.csrfToken;

      // Test POST without CSRF token (should fail)
      cy.request({
        method: 'POST',
        url: `${API_BASE}/csrf/test`,
        headers: { Origin: ALLOWED_ORIGIN },
        body: { message: 'test' },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(403);
      });

      // Test POST with valid CSRF token (should succeed)
      cy.request({
        method: 'POST',
        url: `${API_BASE}/csrf/test`,
        headers: {
          Origin: ALLOWED_ORIGIN,
          'X-CSRF-Token': csrfToken,
          Cookie: `csrf-token=${csrfToken}`,
        },
        body: { message: 'test with csrf' },
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
      });
    });
  });

  it('should reject mismatched CSRF tokens', () => {
    cy.request({
      method: 'GET',
      url: `${API_BASE}/csrf/token`,
      headers: { Origin: ALLOWED_ORIGIN },
    }).then((tokenResponse) => {
      const validToken = tokenResponse.body.csrfToken;
      const invalidToken = 'invalid-token-12345';

      // Test with mismatched header and cookie
      cy.request({
        method: 'POST',
        url: `${API_BASE}/csrf/test`,
        headers: {
          Origin: ALLOWED_ORIGIN,
          'X-CSRF-Token': validToken,
          Cookie: `csrf-token=${invalidToken}`,
        },
        body: { message: 'test' },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(403);
      });
    });
  });

  it('should allow GET requests without CSRF tokens', () => {
    cy.request({
      method: 'GET',
      url: `${API_BASE}/api/health`,
      headers: { Origin: ALLOWED_ORIGIN },
    }).then((response) => {
      expect(response.status).to.eq(200);
    });
  });
});
