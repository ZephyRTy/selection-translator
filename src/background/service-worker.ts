import { translate } from '../utils/translator';

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type === 'TRANSLATE') {
    translate(request.text)
      .then((result) => sendResponse({ success: true, translated: result }))
      .catch((err: Error) => sendResponse({ success: false, error: err.message }));
    return true;
  }
});
