/**
 * Feeling Indicator - Content Script
 * 
 * This script runs in the context of web pages and is responsible for:
 * 1. Extracting messages from various chat platforms
 * 2. Formatting the messages for analysis
 * 3. Sending the extracted data back to the popup or background script
 */

// Listen for messages from popup or background script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "extractMessages") {
    const messages = extractChatMessages();
    
    // Send response to whoever requested the messages
    sendResponse({
      success: messages.length > 0,
      messages: messages
    });
    
    // Don't send a duplicate message to background script
    // This will avoid the double API calls
  }
  return true; // Keep the message channel open for async response
});

/**
 * Extract chat messages from the current page
 * Supports multiple chat platforms using detection heuristics
 * @returns {Array} Array of message objects {sender, text, timestamp}
 */
function extractChatMessages() {
  // Detect which chat platform we're on
  const platform = detectChatPlatform();
  
  // Extract messages based on the platform
  switch (platform) {
    case 'whatsapp':
      return extractWhatsAppMessages();
    case 'messenger':
      return extractMessengerMessages();
    case 'telegram':
      return extractTelegramMessages();
    case 'discord':
      return extractDiscordMessages();
    case 'slack':
      return extractSlackMessages();
    case 'instagram':
      return extractInstagramMessages();
    case 'twitter':
      return extractTwitterMessages();
    case 'tinder':
      return extractTinderMessages();
    case 'generic':
    default:
      return extractGenericChatMessages();
  }
}

/**
 * Detect which chat platform is being used
 * @returns {string} The detected platform name
 */
function detectChatPlatform() {
  const url = window.location.href;
  const htmlContent = document.documentElement.innerHTML;
  
  if (url.includes('web.whatsapp.com')) {
    return 'whatsapp';
  } else if (url.includes('messenger.com') || url.includes('facebook.com/messages')) {
    return 'messenger';
  } else if (url.includes('telegram.org') || url.includes('t.me')) {
    return 'telegram';
  } else if (url.includes('discord.com')) {
    return 'discord';
  } else if (url.includes('slack.com')) {
    return 'slack';
  } else if (url.includes('instagram.com')) {
    return 'instagram';
  } else if (url.includes('twitter.com') || url.includes('x.com')) {
    return 'twitter';
  } else if (url.includes('tinder.com')) {
    return 'tinder';
  } else {
    return 'generic';
  }
}

/**
 * Extract messages from WhatsApp Web
 * @returns {Array} Array of message objects {sender, text, timestamp}
 */
function extractWhatsAppMessages() {
  const messages = [];
  const messageElements = document.querySelectorAll('div.message-in, div.message-out');
  
  messageElements.forEach(element => {
    try {
      const isOutgoing = element.classList.contains('message-out');
      const sender = isOutgoing ? 'Me' : 'Other';
      
      const textElement = element.querySelector('span.selectable-text');
      if (!textElement) return;
      
      const text = textElement.innerText.trim();
      if (!text) return;
      
      const timeElement = element.querySelector('div.copyable-text');
      let timestamp = '';
      
      if (timeElement && timeElement.dataset.prePlainText) {
        timestamp = timeElement.dataset.prePlainText.match(/\[(.*?)\]/)?.[1] || '';
      }
      
      messages.push({ sender, text, timestamp });
    } catch (e) {
      console.error('Error extracting WhatsApp message:', e);
    }
  });
  
  return messages;
}

/**
 * Extract messages from Facebook Messenger
 * @returns {Array} Array of message objects {sender, text, timestamp}
 */
function extractMessengerMessages() {
  const messages = [];
  const messageElements = document.querySelectorAll('div[role="row"]');
  
  let currentSender = null;
  
  messageElements.forEach(element => {
    try {
      const messageText = element.querySelector('div[data-content-type="message"]');
      if (!messageText) return;
      
      const messageWrapper = element.closest('[data-scope="messages_table"]');
      const isOutgoing = element.getAttribute('data-is-outgoing') === 'true' || 
                          (messageWrapper && window.getComputedStyle(element).textAlign === 'right');
      
      const sender = isOutgoing ? 'Me' : 'Other';
      const text = messageText.textContent.trim();
      
      if (text) {
        const timestamp = element.querySelector('span[role="tooltip"]')?.textContent || '';
        
        messages.push({ sender, text, timestamp });
      }
    } catch (e) {
      console.error('Error extracting Messenger message:', e);
    }
  });
  
  return messages;
}

/**
 * Extract messages from Telegram Web
 * @returns {Array} Array of message objects {sender, text, timestamp}
 */
function extractTelegramMessages() {
  const messages = [];
  const messageElements = document.querySelectorAll('.message');
  
  messageElements.forEach(element => {
    try {
      const isOutgoing = element.classList.contains('message-out');
      const sender = isOutgoing ? 'Me' : 'Other';
      
      const textElement = element.querySelector('.text-content');
      if (!textElement) return;
      
      const text = textElement.textContent.trim();
      if (!text) return;
      
      const timeElement = element.querySelector('.time');
      const timestamp = timeElement ? timeElement.textContent.trim() : '';
      
      messages.push({ sender, text, timestamp });
    } catch (e) {
      console.error('Error extracting Telegram message:', e);
    }
  });
  
  return messages;
}

/**
 * Extract messages from Discord
 * @returns {Array} Array of message objects {sender, text, timestamp}
 */
function extractDiscordMessages() {
  const messages = [];
  const messageElements = document.querySelectorAll('[class*="message-"]');
  
  let lastSender = null;
  
  messageElements.forEach(element => {
    try {
      const usernameElement = element.querySelector('[class*="username-"]');
      let sender = usernameElement ? usernameElement.textContent.trim() : lastSender;
      
      if (!sender) return;
      
      lastSender = sender;
      
      const isOutgoing = element.classList.contains('sending') || 
                          element.classList.contains('mentioned') ||
                          element.getAttribute('data-is-author-self') === 'true';
      
      sender = isOutgoing ? 'Me' : sender;
      
      const contentElement = element.querySelector('[class*="content-"]');
      if (!contentElement) return;
      
      const text = contentElement.textContent.trim();
      if (!text) return;
      
      const timestampElement = element.querySelector('[class*="timestamp-"]');
      const timestamp = timestampElement ? timestampElement.textContent.trim() : '';
      
      messages.push({ sender, text, timestamp });
    } catch (e) {
      console.error('Error extracting Discord message:', e);
    }
  });
  
  return messages;
}

/**
 * Extract messages from Slack
 * @returns {Array} Array of message objects {sender, text, timestamp}
 */
function extractSlackMessages() {
  const messages = [];
  const messageElements = document.querySelectorAll('.c-message');
  
  messageElements.forEach(element => {
    try {
      const senderElement = element.querySelector('.c-message__sender');
      if (!senderElement) return;
      
      const sender = senderElement.textContent.trim();
      
      const isOutgoing = element.classList.contains('c-message--me');
      const senderName = isOutgoing ? 'Me' : sender;
      
      const textElement = element.querySelector('.c-message__body');
      if (!textElement) return;
      
      const text = textElement.textContent.trim();
      if (!text) return;
      
      const timestampElement = element.querySelector('.c-timestamp');
      const timestamp = timestampElement ? timestampElement.textContent.trim() : '';
      
      messages.push({ sender: senderName, text, timestamp });
    } catch (e) {
      console.error('Error extracting Slack message:', e);
    }
  });
  
  return messages;
}

/**
 * Extract messages from Instagram DMs
 * @returns {Array} Array of message objects {sender, text, timestamp}
 */
function extractInstagramMessages() {
  const messages = [];
  const messageElements = document.querySelectorAll('div[role="listitem"]');
  
  messageElements.forEach(element => {
    try {
      const textElement = element.querySelector('div[dir="auto"]');
      if (!textElement) return;
      
      const text = textElement.textContent.trim();
      if (!text) return;
      
      const isOutgoing = window.getComputedStyle(element.parentElement).justifyContent === 'flex-end';
      const sender = isOutgoing ? 'Me' : 'Other';
      
      const timestamp = '';
      
      messages.push({ sender, text, timestamp });
    } catch (e) {
      console.error('Error extracting Instagram message:', e);
    }
  });
  
  return messages;
}

/**
 * Extract messages from Twitter/X DMs
 * @returns {Array} Array of message objects {sender, text, timestamp}
 */
function extractTwitterMessages() {
  const messages = [];
  const messageElements = document.querySelectorAll('[data-testid="messageEntry"]');
  
  messageElements.forEach(element => {
    try {
      const textElement = element.querySelector('[data-testid="messageEntry-content"]');
      if (!textElement) return;
      
      const text = textElement.textContent.trim();
      if (!text) return;
      
      const isOutgoing = element.classList.contains('outgoing') || 
                         window.getComputedStyle(element).alignSelf === 'flex-end';
      const sender = isOutgoing ? 'Me' : 'Other';
      
      const timestampElement = element.querySelector('time');
      const timestamp = timestampElement ? timestampElement.textContent.trim() : '';
      
      messages.push({ sender, text, timestamp });
    } catch (e) {
      console.error('Error extracting Twitter message:', e);
    }
  });
  
  return messages;
}

/**
 * Extract messages from Tinder chat
 * @returns {Array} Array of message objects {sender, text, timestamp}
 */
function extractTinderMessages() {
  const messages = [];
  const messageElements = document.querySelectorAll('.msg');
  
  messageElements.forEach(element => {
    try {
      const isOutgoing = element.classList.contains('sent');
      const sender = isOutgoing ? 'Me' : 'Other';
      
      const text = element.textContent.trim();
      if (!text) return;
      
      const timestampElement = element.querySelector('.date');
      const timestamp = timestampElement ? timestampElement.textContent.trim() : '';
      
      messages.push({ sender, text, timestamp });
    } catch (e) {
      console.error('Error extracting Tinder message:', e);
    }
  });
  
  return messages;
}

/**
 * Generic message extractor for unrecognized chat platforms
 * Uses heuristics to identify chat messages in any page
 * @returns {Array} Array of message objects {sender, text, timestamp}
 */
function extractGenericChatMessages() {
  const messages = [];
  
  const possibleSelectors = [
    '.message', '[class*="message"]', '[class*="msg"]', '.chat-message',
    'li.chat', '[role="listitem"]', '[role="row"]',
    '.bubble', '.chat-bubble', '[class*="bubble"]',
    '.content', '.text-content', '[class*="content-"]'
  ];
  
  let bestElements = [];
  let bestSelector = '';
  
  possibleSelectors.forEach(selector => {
    try {
      const elements = document.querySelectorAll(selector);
      if (elements.length > bestElements.length) {
        bestElements = Array.from(elements);
        bestSelector = selector;
      }
    } catch (e) {
      // Ignore errors from invalid selectors
    }
  });
  
  bestElements.forEach(element => {
    try {
      const isOutgoing = hasOutgoingIndicators(element);
      const sender = isOutgoing ? 'Me' : 'Other';
      
      let text = element.textContent.trim();
      
      text = cleanupMessageText(text);
      
      if (text.length > 0 && text.length < 1000) {
        messages.push({
          sender,
          text,
          timestamp: ''
        });
      }
    } catch (e) {
      console.error('Error extracting generic message:', e);
    }
  });
  
  return messages;
}

/**
 * Check if an element has indicators of being an outgoing message
 * @param {Element} element - The message element to check
 * @returns {boolean} - True if the element appears to be an outgoing message
 */
function hasOutgoingIndicators(element) {
  const outgoingClasses = ['sent', 'outgoing', 'out', 'message-out', 'self', 'right'];
  const elementClasses = Array.from(element.classList);
  
  for (const cls of outgoingClasses) {
    if (elementClasses.some(c => c.includes(cls))) {
      return true;
    }
  }
  
  const style = window.getComputedStyle(element);
  if (style.textAlign === 'right' || style.alignSelf === 'flex-end' || 
      style.marginLeft === 'auto' || style.justifyContent === 'flex-end') {
    return true;
  }
  
  const readIndicators = ['read', 'seen', 'delivered', 'tick', 'check'];
  if (element.innerHTML.match(new RegExp(readIndicators.join('|'), 'i'))) {
    return true;
  }
  
  return false;
}

/**
 * Clean up message text by removing UI elements and timestamps
 * @param {string} text - The raw message text
 * @returns {string} - Cleaned message text
 */
function cleanupMessageText(text) {
  text = text.replace(/\d{1,2}:\d{2}(\s?[AP]M)?/g, '');
  
  text = text.replace(/seen|read|delivered|sent/gi, '');
  
  if (text.length <= 4 && /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g.test(text)) {
    return '';
  }
  
  return text.trim();
} 