// TODO: improve extracting data
// TODO: build llm picker 
// TODO: optimization of AI configurations
// TODO: check a bit of legals

let isInitialized = false;
let counter = 0;

function initializeContentScript() {
  if (isInitialized) return;

  // Listen for messages from the background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'summarizeHeadlines') {
      counter = 0;
      summarizeHeadlines();
      sendResponse({status: 'Processing started'});
    }
    return true;
  });

  isInitialized = true;
}

async function summarizeHeadlines() {
  let apiKey = "";
  // try {
  //   apiKey = await getApiKey();
  //   if (!apiKey) {
  //     await promptForApiKey('Please enter your API key');
  //     return;
  //   }
  // } catch (error) {
  //   console.error('Error checking API key:', error);
  //   await createNotification('Error checking API key. Please try again.');
  // }
  const limit = 20;

  // This function will be injected into the page
  let headlines = Array.from(document.querySelectorAll('a, a span, h1, h2, h3, h4, h5, h6, span[class*="title"], strong[data-type*="title"], span[class*="headline"], strong[data-type*="headline"], span[data-type*="title"], strong[class*="title"], span[data-type*="headline"], strong[class*="headline"], span[class*="Title"], strong[data-type*="Title"], span[class*="Headline"], strong[data-type*="Headline"], span[data-type*="Title"], strong[class*="Title"], span[data-type*="Headline"], strong[class*="Headline"]'));
  
  // Filter out headlines with images
  headlines = headlines.filter(headline => !headline.querySelector('img'));

  // // Find the majority headlines url hostname
  // const hostnameCounts = headlines.reduce((acc, headline) => {
  //   const articleUrl = headline.href || headline.closest('a')?.href;
  //   if (articleUrl) {
  //     try {
  //       const url = new URL(articleUrl);
  //       acc[url.hostname] = (acc[url.hostname] || 0) + 1;
  //     } catch (error) {
  //       console.error('Invalid URL:', articleUrl);
  //     }
  //   }
  //   return acc;
  // }, {});

  // const majorityHostname = Object.keys(hostnameCounts).reduce((a, b) => 
  //   hostnameCounts[a] > hostnameCounts[b] ? a : b
  // , '');

  // // Filter out headlines that are not links or link to another website
  // const currentDomain = window.location.hostname;
  // headlines = headlines.filter(headline => {
  //   try {
  //     const articleUrl = headline.href || headline.closest('a')?.href;
  //     if (articleUrl) {
  //       const url = new URL(articleUrl);
  //       return url.hostname === currentDomain || url.hostname === majorityHostname;
  //     }
  //     return false;
  //   } catch {
  //     return false;
  //   }

  // });

  // Filter out headlines that are not in the user's screen frame with a little extra space
  const viewportHeight = window.innerHeight;
  const viewportTop = window.scrollY - 300; // Add extra space at the top
  const viewportBottom = viewportTop + viewportHeight + 300; // Add extra space at the bottom

  headlines = headlines.filter(headline => {
    const rect = headline.getBoundingClientRect();
    const headlineTop = rect.top + window.scrollY;
    const headlineBottom = rect.bottom + window.scrollY;
    return (headlineTop >= viewportTop && headlineBottom <= viewportBottom);
  });

  // Filter out subject headlines
  headlines = headlines.filter(headline => headline.textContent.split(' ').length > 3);

  // Sort headlines by font size in descending order
  headlines.sort((a, b) => {
    const fontSizeA = parseFloat(window.getComputedStyle(a).fontSize);
    const fontSizeB = parseFloat(window.getComputedStyle(b).fontSize);
    return fontSizeB - fontSizeA;
  });

  // Process only the top <limit> headlines
  let promises = [];
  for (let i = counter; i < Math.min(limit + counter, headlines.length); i++) {
    const headline = headlines[i];
    const articleUrl = headline.href || headline.closest('a')?.href;
    if (articleUrl) {
      promises.push(
        fetchSummary(articleUrl, apiKey).then(summary => {
          headline.textContent = summary;
          counter++;
        })
        .catch(error => {
          throw new Error(error.message);
        })
      );
    }
  }

  try {
    await Promise.all(promises);
  } catch (error) {
    createNotification(error.message);
  }
}

// async function fetchSummary(url) {
  // This is a placeholder function. You'll need to implement the actual API call.
  // const response = await fetch('YOUR_LANGUAGE_MODEL_API', {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json',
  //   },
  //   body: JSON.stringify({ url: url }),
  // });
  // const data = await response.json();
  // const response = await fetch(url);
  // const text = await response.text();
  // const parser = new DOMParser();
  // const doc = parser.parseFromString(text, 'text/html');
  // const content = doc.body.innerText;
  // return content.split('\n').slice(0, 5).join(' '); // Return the first 5 lines as a summary
  //return "Headline!";
//}
async function fetchSummary(url, apiKey) {
  let summary = "";
  try {
    const content = await fetchContent(url);
    summary = await summarizeContnet(content, apiKey);//.split(' ').slice(0, 50).join(' '));
  } catch (error) {
    throw new Error(error.message);
  }
  return summary;
  // return new Promise((resolve, reject) => {
  //   fetchContent(url)
  //     .then(content => summarizeContnet(content))
  //     .then(summary => resolve(summary))
  //     .catch(error => {
  //       console.error('Error fetching or summarizing content:', error);
  //       reject('Error fetching summary5');
  //     });
  // });
}

// Send a message to the background script to fetch a summary
async function fetchContent(url) {
  const response = await chrome.runtime.sendMessage({ action: 'fetchContent', url: url });
  if (!response || response?.error || !response.html) {
    throw new Error('Error fetching article content' + response?.error);
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(response.html, 'text/html');
  const paragraphs = Array.from(doc.querySelectorAll('p'));
  let content = paragraphs.map(p => p.textContent).join(' ').trim();
  return content;
  // return new Promise((resolve, reject) => {
  //   chrome.runtime.sendMessage({ action: 'fetchSummary', url: url }, response => {
  //     if (response && response.html) {
  //       const parser = new DOMParser();
  //       const doc = parser.parseFromString(response.html, 'text/html');
        
  //       // Extract text content from <p> tags
  //       const paragraphs = Array.from(doc.querySelectorAll('p'));
  //       let content = paragraphs.map(p => p.textContent).join(' ').trim();
        
  //       // Return the first 5 lines as a summary
  //       content = content.split('\n').slice(0, 5).join(' ');
  //       resolve(content)
  //       } else {
  //       reject('Error fetching summary6');
  //     }
  //   });
  // });
}

async function summarizeContnet(content, apiKey) {
  const prompt = "please summarize this article to an informative (not clickbate) and short headline, in the article language: " + content;
  const response = await chrome.runtime.sendMessage({ action: 'AIcall', prompt: prompt, apiKey: apiKey });
  if (!response || response?.error ||  !response.summary) {
    throw new Error('Error fetching AI summary ' + response?.error);
  }
  return response.summary;
  // return new Promise((resolve, reject) => {
  //   chrome.runtime.sendMessage({ action: 'AIcall', prompt: prompt }, response => {
  //     if (response && response.summary) {
  //       resolve(response.summary);
  //     }else {
  //       reject('Error fetching summary7');
  //     }
  //   })});
}

async function getApiKey() {
  const result = await chrome.storage.sync.get(['apiKey']);
  return result.apiKey;
}


function createApiKeyPrompt(message, currentKey = '') {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
  `;

  const promptBox = document.createElement('div');
  promptBox.style.cssText = `
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    width: 300px;
  `;

  const title = document.createElement('h3');
  title.textContent = message;
  title.style.marginBottom = '15px';

  const linkToGenerateKey = document.createElement('a');
  linkToGenerateKey.textContent = 'Generate an API key';
  linkToGenerateKey.href = 'https://console.groq.com/keys';
  linkToGenerateKey.target = '_blank';
  linkToGenerateKey.style.cssText = `
    display: block;
    margin-bottom: 15px;
    color: #4285F4;
  `;

  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentKey;
  input.placeholder = 'Enter your API key';
  input.style.cssText = `
    width: 100%;
    padding: 8px;
    margin-bottom: 15px;
    border: 1px solid #ccc;
    border-radius: 4px;
  `;

  const submitButton = document.createElement('button');
  submitButton.textContent = 'Save';
  submitButton.style.cssText = `
    background: #4285F4;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    margin-right: 10px;
  `;

  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'Cancel';
  cancelButton.style.cssText = `
    background: #gray;
    border: 1px solid #ccc;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
  `;

  promptBox.appendChild(linkToGenerateKey);
  promptBox.appendChild(title);
  promptBox.appendChild(input);
  promptBox.appendChild(submitButton);
  promptBox.appendChild(cancelButton);
  overlay.appendChild(promptBox);

  return { overlay, input, submitButton, cancelButton };
}

function createNotificationPrompt(message) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
  `;

  const promptBox = document.createElement('div');
  promptBox.style.cssText = `
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    width: 300px;
  `;

  const title = document.createElement('h3');
  title.textContent = message;
  title.style.marginBottom = '15px';

  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'OK';
  cancelButton.style.cssText = `
    background: #gray;
    border: 1px solid #ccc;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    align-self: flex-center;
  `;

  promptBox.appendChild(title);
  promptBox.appendChild(cancelButton);
  overlay.appendChild(promptBox);

  return { overlay, cancelButton };
}


async function promptForApiKey(message, currentKey = '') {
  return new Promise((resolve, reject) => {
    const { overlay, input, submitButton, cancelButton } = createApiKeyPrompt(message, currentKey);
    document.body.appendChild(overlay);

    submitButton.onclick = async () => {
      const apiKey = input.value.trim();
      if (apiKey) {
        await chrome.storage.sync.set({ apiKey });
        document.body.removeChild(overlay);
        summarizeHeadlines();
        resolve(apiKey);
      } else {
        input.style.border = '1px solid red';
      }
    };

    cancelButton.onclick = () => {
      document.body.removeChild(overlay);
      resolve(null);
    };
  });
}

async function createNotification(message) {
  return new Promise((resolve, reject) => {
    const { overlay, cancelButton } = createNotificationPrompt(message);
    document.body.appendChild(overlay);

    cancelButton.onclick = () => {
      document.body.removeChild(overlay);
      resolve(null);
    };
  });
}

initializeContentScript();