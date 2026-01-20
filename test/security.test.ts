import { describe, it, expect, vi, afterEach } from 'vitest';
import { appendTokenQuery } from '../src/network';
import { renderDefaultModal } from '../src/renderer';
import { ResolvedShieldConfig } from '../src/types';

describe('Security Checks', () => {

  describe('URL Handling (appendTokenQuery)', () => {
    it('should correctly append token to relative URLs', () => {
      const result = appendTokenQuery('/api/verify', 'abc');
      expect(result).toBe('/api/verify?token=abc');
    });

    it('should correctly append token to absolute URLs', () => {
      const result = appendTokenQuery('https://example.com/api', 'abc');
      expect(result).toBe('https://example.com/api?token=abc');
    });

    it('should preserve existing query parameters', () => {
      const result = appendTokenQuery('/api/verify?v=1', 'abc');
      expect(result).toContain('v=1');
      expect(result).toContain('token=abc');
    });

    it('should handle weird protocol inputs by treating them as paths if invalid', () => {
       // Note: fetch() will likely reject this later, but we ensure we don't crash
      const result = appendTokenQuery('javascript:alert(1)', 'abc');
      expect(result).toBe('javascript:alert(1)?token=abc');
    });
  });

  describe('XSS Prevention in Default Modal', () => {
    /* Setup basic DOM environment for renderer */
    const mockConfig: any = {
      modal: {
        styles: {
          overlayClass: 'overlay',
          panelClass: 'panel',
          titleClass: 'title',
          bodyClass: 'body',
          helperClass: 'helper',
          customCss: '',
        },
        copy: {
          title: '<script>alert("xss")</script>Title',
          body: '<img src=x onerror=alert(1)>Body',
          helperText: '<b>Helper</b>',
        },
        injectDefaultStyle: false,
      },
      integrity: {} 
    };

    it('should render title as textContent, not innerHTML', () => {
      const context: any = {
        challengeContainer: document.createElement('div'),
        config: mockConfig,
        close: vi.fn(),
      };
      
      const { root } = renderDefaultModal(context);
      const title = root.querySelector('.title');
      
      expect(title?.textContent).toBe('<script>alert("xss")</script>Title');
      expect(title?.innerHTML).not.toContain('<script>');
      // HTML specific check: < within textContent is encoded as &lt; in innerHTML output usually, 
      // but key is that no script tag exists in the DOM structure.
      expect(root.querySelectorAll('script').length).toBe(0);
    });

    it('should render body as textContent', () => {
        const context: any = {
          challengeContainer: document.createElement('div'),
          config: mockConfig,
          close: vi.fn(),
        };
        
        const { root } = renderDefaultModal(context);
        const body = root.querySelector('.body');
        
        expect(body?.textContent).toBe('<img src=x onerror=alert(1)>Body');
        expect(root.querySelectorAll('img').length).toBe(0);
    });
  });

});
