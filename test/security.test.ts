import { describe, it, expect, vi } from 'vitest';
import { renderDefaultModal } from '../src/renderer';

describe('Security Checks', () => {

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
