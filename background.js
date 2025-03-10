/**
 * Feeling Indicator - Background Script
 * 
 * This script runs in the background and handles:
 * 1. Persisting API requests even when popup is closed
 * 2. Storing analysis results for immediate display when popup reopens
 * 3. Communication between popup and content scripts
 */

// State to store between popup openings
let state = {
  isAnalyzing: false,
  lastResult: null,
  apiKey: null,
  currentTabId: null
};

// Listen for messages from popup or content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Messages from popup
  if (message.action === "startAnalysis") {
    // Get API key if not already available
    if (!state.apiKey) {
      chrome.storage.sync.get(['apiKey'], function(result) {
        if (result.apiKey) {
          state.apiKey = result.apiKey;
          performAnalysis(message.tabId);
        } else {
          sendResponse({ success: false, error: "API key not found" });
        }
      });
    } else {
      performAnalysis(message.tabId);
    }
    return true; // Keep the message channel open for async response
  }
  
  // Request for latest result from popup
  else if (message.action === "getAnalysisStatus") {
    sendResponse({
      isAnalyzing: state.isAnalyzing,
      lastResult: state.lastResult,
      success: true
    });
    return false; // No async response needed
  }
  
  // Messages from content script with extracted messages
  else if (message.action === "messagesExtracted") {
    if (state.isAnalyzing) {
      analyzeMessages(message.messages);
    }
    return false; // No async response needed
  }
});

/**
 * Start the message extraction process
 * @param {number} tabId - The ID of the active tab
 */
function performAnalysis(tabId) {
  state.isAnalyzing = true;
  state.currentTabId = tabId;
  
  // Let the popup know we're analyzing
  chrome.runtime.sendMessage({
    action: "analysisStarted"
  });
  
  // Send message to content script to extract messages
  chrome.tabs.sendMessage(
    tabId,
    { action: "extractMessages" },
    function(response) {
      if (chrome.runtime.lastError || !response) {
        handleError("Could not extract messages. Make sure you're on a chat page!");
        return;
      }
      
      if (response.success && response.messages.length > 0) {
        analyzeMessages(response.messages);
      } else {
        handleError("No chat messages found on this page!");
      }
    }
  );
}

/**
 * Analyze messages using DeepSeek API
 * @param {Array} messages - Array of message objects {sender, text, timestamp}
 */
function analyzeMessages(messages) {
  // Create a prompt for the DeepSeek API
  const prompt = createAnalysisPrompt(messages);
  
  // Call DeepSeek API
  fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${state.apiKey}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: 'You are a ruthlessly honest relationship analyzer who uses a 0-100% scale to measure romantic connection. IMPORTANT RULES: (1) If there\'s NO flirting or romantic interest, the score MUST be 0% - not 10%, not 40%, ZERO. (2) Be extremely strict with your scoring. (3) For scores below 50%, include ONE BRIEF improvement tip (1-2 lines max). (4) Only high chemistry with clear romantic interest gets scores above 70%. (5) YOU MUST START YOUR RESPONSE WITH A PERCENTAGE (e.g. "80%", "25%", "0%") followed by " - " and then your assessment. (6) BE EXTREMELY CONCISE but make sure your entire message is visible. Use Tyler Durden\'s direct style from Fight Club - brutal honesty with no sugar-coating.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 200
    })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
    try {
      // Log the entire API response for debugging
      console.log("API Response:", data);
      
      // Extract result from API response
      const resultContent = data.choices[0].message.content;
      console.log("Raw content:", resultContent);
      
      // Parse percentage and message from the response
      let percentage = 0;
      let matchFound = false;
      let matchText = '';
      
      // Try to find percentage pattern (e.g., "80%", "0%")
      const percentMatch = resultContent.match(/\b([0-9]{1,3})%\b/);
      if (percentMatch) {
        percentage = parseInt(percentMatch[1]);
        matchFound = true;
        matchText = percentMatch[0];
        console.log("Extracted percentage via regex:", percentage);
      } else {
        // Try alternate pattern - just a number at the start
        const numberMatch = resultContent.match(/^[^\d]*(\d+)[^\d%]*/);
        if (numberMatch) {
          percentage = parseInt(numberMatch[1]);
          matchFound = true;
          matchText = numberMatch[0];
          console.log("Extracted percentage from beginning:", percentage);
        } else {
          // If no percentage is found, force to zero and show error message
          percentage = 0;
          console.error("No percentage found in response, defaulting to 0%");
          handleError("Could not parse percentage from AI response. Try again.");
          return;
        }
      }
      
      // Ensure percentage is within 0-100 range
      percentage = Math.max(0, Math.min(100, percentage));
      console.log("Final percentage to display:", percentage);
      
      // Extract explanation text - take everything after the percentage
      let explanation = resultContent
      console.log("Final explanation:", explanation);
      
      // Store the result
      state.lastResult = {
        percentage,
        explanation,
        timestamp: new Date().getTime()
      };
      
      // Update state
      state.isAnalyzing = false;
      
      // Send result to popup if it's open
      chrome.runtime.sendMessage({
        action: "analysisComplete",
        result: state.lastResult
      });
      
    } catch (error) {
      console.error("Error processing API response:", error);
      handleError("Could not parse the API response: " + error.message);
    }
  })
  .catch(error => {
    console.error("API Error:", error);
    handleError("API Error: " + error.message);
  });
}

/**
 * Creates a prompt for the DeepSeek API based on messages
 * @param {Array} messages - Array of message objects
 * @returns {string} - The formatted prompt
 */
function createAnalysisPrompt(messages) {
  // Group messages by sender
  const senderGroups = {};
  messages.forEach(msg => {
    if (!senderGroups[msg.sender]) {
      senderGroups[msg.sender] = [];
    }
    senderGroups[msg.sender].push(msg);
  });
  
  // Get the two participants (assuming two people in chat)
  const participants = Object.keys(senderGroups).slice(0, 2);
  
  // Format conversation for analysis
  let conversationText = '';
  messages.forEach((msg, index) => {
    conversationText += `${msg.sender}: ${msg.text}\n`;
  });
  
  // Create the prompt
  return `
Analyze this chat for romantic connection between ${participants.join(' and ')}:

SCORING RULES:
- If there's NO flirting or romantic interest at all: SCORE MUST BE 0%
- Be EXTREMELY strict with scoring: casual chitchat = 0%, mild flirting = 20-30%, strong flirting = 50-70%, obvious mutual attraction = 70%+
- For scores below 50%, include ONE very short tip (1-2 lines max)
- YOU MUST START YOUR RESPONSE WITH THE PERCENTAGE (e.g., "75%") followed by " - " (dash)
- Make sure all your text is visible - avoid cutting off sentences
- Be brutally honest and direct like Tyler Durden from Fight Club

FORMAT EXACTLY LIKE THIS:
[0-100]% - [Your brutal assessment] + [Short tip if score < 50%]

Examples of properly formatted responses:
- "0% - Just basic information exchange. No flirting at all. Tip: Ask personal questions."
- "25% - Weak flirting attempts, mostly one-sided. Tip: Be more direct."
- "75% - Clear sexual tension. Messages dripping with mutual interest."
- "90% - You're both one message away from setting up a date."

Conversation:
${conversationText}

Your brutally honest assessment (START WITH PERCENTAGE):`;
}

/**
 * Handle errors
 * @param {string} message - The error message
 */
function handleError(message) {
  console.error(message);
  
  // Update state
  state.isAnalyzing = false;
  state.lastResult = null;
  
  // Send error to popup if it's open
  chrome.runtime.sendMessage({
    action: "analysisError",
    error: message
  });
} 