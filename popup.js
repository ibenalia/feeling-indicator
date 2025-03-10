/**
 * Feeling Indicator - Chrome Extension
 * 
 * A retro-styled 8-bit extension that analyzes chat conversations
 * to determine the romantic connection level between participants.
 * 
 * Features:
 * - 8-bit UI with pixel art and retro animations
 * - Real-time chat analysis using DeepSeek API
 * - Sound effects and visual feedback
 * - Support for multiple chat platforms
 * 
 * @author Your Name
 * @version 1.0.0
 * @license MIT
 */

document.addEventListener('DOMContentLoaded', function() {
  // DOM Elements
  const UI = {
    apiKey: {
      input: document.getElementById('api-key'),
      saveButton: document.getElementById('save-api-key'),
      status: document.getElementById('key-status')
    },
    sections: {
      setup: document.getElementById('setup-section'),
      result: document.getElementById('result-section'),
      loading: document.getElementById('loading-section'),
      error: document.getElementById('error-section')
    },
    buttons: {
      analyze: document.getElementById('analyze-button'),
      settings: document.getElementById('settings-button')
    },
    vibe: {
      bar: document.getElementById('vibe-bar'),
      percentage: document.getElementById('vibe-percentage'),
      message: document.getElementById('vibe-message')
    },
    loader: document.querySelector('.c-loader'),
    error: document.getElementById('error-message')
  };

  // Audio Configuration
  const AUDIO = {
    loading: {
      frequency: 587.33, // D5 note
      duration: 0.5
    },
    success: {
      baseFrequency: 523.25, // C5 note
      noteLength: 0.1,
      notes: [
        { freq: 523.25, time: 0 },     // C5
        { freq: 659.25, time: 0.1 },   // E5
        { freq: 783.99, time: 0.2 }    // G5
      ]
    },
    error: {
      frequency: 130.81, // C3 note
      duration: 0.8
    }
  };

  // State
  let apiKey = '';

  /**
   * Initialize the extension
   */
  function init() {
    checkStoredApiKey();
    checkBackgroundStatus();
    setupEventListeners();
  }

  /**
   * Check if API key is stored and update UI accordingly
   */
  function checkStoredApiKey() {
    chrome.storage.sync.get(['apiKey'], function(result) {
      if (result.apiKey) {
        apiKey = result.apiKey;
        UI.apiKey.input.value = '••••••••••••••••';
        updateApiKeyStatus('API key saved! Ready to analyze vibes!', true);
        UI.sections.setup.style.display = 'none';
      }
    });
  }

  /**
   * Set up event listeners for user interactions
   */
  function setupEventListeners() {
    // Message listener for background script communication
    chrome.runtime.onMessage.addListener(handleBackgroundMessages);

    // Button click handlers
    UI.apiKey.saveButton.addEventListener('click', handleApiKeySave);
    UI.buttons.settings.addEventListener('click', toggleSettings);
    UI.buttons.analyze.addEventListener('click', handleAnalyzeClick);
  }

  /**
   * Handle messages from the background script
   */
  function handleBackgroundMessages(message, sender, sendResponse) {
    switch (message.action) {
      case 'analysisStarted':
        showLoadingState();
        break;
      case 'analysisComplete':
        handleAnalysisComplete(message.result);
        break;
      case 'analysisError':
        handleError(message.error);
        break;
    }
  }

  /**
   * Handle successful analysis completion
   */
  function handleAnalysisComplete(result) {
    showCompleteState();
    setTimeout(() => {
      displayResults(result.percentage, result.explanation);
      playSuccessSound(result.percentage);
    }, 1500);
  }

  /**
   * Save API key to storage
   */
  function handleApiKeySave() {
    const inputKey = UI.apiKey.input.value.trim();
    
    if (!inputKey) {
      updateApiKeyStatus('Please enter a valid API key!', false);
      return;
    }

    chrome.storage.sync.set({ apiKey: inputKey }, function() {
      apiKey = inputKey;
      updateApiKeyStatus('API key saved! Ready to analyze vibes!', true);
      setTimeout(() => {
        UI.sections.setup.style.display = 'none';
      }, 1500);
    });
  }

  /**
   * Update API key status message
   */
  function updateApiKeyStatus(message, isSuccess) {
    UI.apiKey.status.textContent = message;
    UI.apiKey.status.style.color = isSuccess ? 'var(--good-vibe-color)' : 'var(--bad-vibe-color)';
  }

  /**
   * Toggle settings visibility
   */
  function toggleSettings() {
    UI.sections.setup.style.display = 
      UI.sections.setup.style.display === 'none' ? 'block' : 'none';
  }

  /**
   * Handle analyze button click
   */
  function handleAnalyzeClick() {
    if (!apiKey) {
      UI.sections.setup.style.display = 'block';
      updateApiKeyStatus('Please set your API key first!', false);
      return;
    }

    showLoadingState();
    playLoadingSound();
    requestAnalysis();
  }

  /**
   * Request message analysis from background script
   */
  function requestAnalysis() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      chrome.runtime.sendMessage({
        action: 'startAnalysis',
        tabId: tabs[0].id
      });
    });
  }

  /**
   * Check background script for ongoing analysis or recent results
   */
  function checkBackgroundStatus() {
    chrome.runtime.sendMessage({ action: 'getAnalysisStatus' }, function(response) {
      if (response?.success) {
        if (response.isAnalyzing) {
          showLoadingState();
        } else if (response.lastResult) {
          displayResults(response.lastResult.percentage, response.lastResult.explanation);
        }
      }
    });
  }

  /**
   * Show loading state in UI
   */
  function showLoadingState() {
    if (UI.loader) {
      UI.loader.classList.remove('is--loading', 'is--complete');
      void UI.loader.offsetWidth; // Force reflow
      UI.loader.classList.add('is--loading');
    }

    UI.sections.result.style.display = 'none';
    UI.sections.error.style.display = 'none';
    UI.sections.loading.style.display = 'flex';
  }

  /**
   * Show completion state in UI
   */
  function showCompleteState() {
    if (UI.loader) {
      UI.loader.classList.remove('is--loading');
      UI.loader.classList.add('is--complete');
    }
  }

  /**
   * Display analysis results in UI
   */
  function displayResults(percentage, explanation) {
    // Update visibility
    UI.sections.loading.style.display = 'none';
    UI.sections.result.style.display = 'block';

    // Validate UI elements
    if (!UI.vibe.bar || !UI.vibe.percentage || !UI.vibe.message) {
      return;
    }

    // Update vibe meter
    UI.vibe.bar.style.width = `${percentage}%`;
    UI.vibe.percentage.textContent = `${percentage}%`;

    // Format and display message
    const formattedMessage = formatResultMessage(percentage, explanation);
    UI.vibe.message.textContent = formattedMessage;

    // Update color based on percentage
    updateVibeColor(percentage);

    // Add animation effect
    animatePercentage();
  }

  /**
   * Format the result message with proper structure
   */
  function formatResultMessage(percentage, explanation) {
    let cleanExplanation = explanation;
    
    // Remove percentage prefix if present
    if (cleanExplanation.startsWith(`${percentage}%`)) {
      cleanExplanation = cleanExplanation.substring(`${percentage}%`.length).trim();
    }
    
    // Remove leading punctuation
    cleanExplanation = cleanExplanation.replace(/^[-\s]+/, '');
    
    // Split main message and tip
    const [mainMessage, ...tipParts] = cleanExplanation.split('Tip:');
    const tipMessage = tipParts.join('Tip:').trim();
    
    // Construct formatted message
    let formattedMessage = `${percentage}% - ${mainMessage.trim()}`;
    if (tipMessage) {
      formattedMessage += `\n\nTip: ${tipMessage}`;
    }
    
    return formattedMessage;
  }

  /**
   * Update vibe percentage color based on score
   */
  function updateVibeColor(percentage) {
    let color = 'var(--good-vibe-color)';
    if (percentage < 30) {
      color = 'var(--bad-vibe-color)';
    } else if (percentage < 70) {
      color = 'var(--medium-vibe-color)';
    }
    UI.vibe.percentage.style.color = color;
  }

  /**
   * Animate the percentage display
   */
  function animatePercentage() {
    UI.vibe.percentage.classList.add('pulse-animation');
    setTimeout(() => {
      UI.vibe.percentage.classList.remove('pulse-animation');
    }, 1000);
  }

  /**
   * Handle error states
   */
  function handleError(message) {
    if (UI.loader) {
      UI.loader.classList.remove('is--loading', 'is--complete');
    }
    
    UI.sections.loading.style.display = 'none';
    UI.sections.result.style.display = 'none';
    UI.sections.error.style.display = 'block';
    UI.error.textContent = message;
    
    playErrorSound();
  }

  /**
   * Play loading sound effect
   */
  function playLoadingSound() {
    playSound({
      frequency: AUDIO.loading.frequency,
      duration: AUDIO.loading.duration,
      type: 'square',
      gain: 0.3
    });
  }

  /**
   * Play success sound effect
   */
  function playSuccessSound(percentage) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const finalFreq = AUDIO.success.baseFrequency + (percentage * 2.93);
    
    [...AUDIO.success.notes, { freq: finalFreq, time: AUDIO.success.noteLength * 3 }]
      .forEach(note => {
        playNote(audioContext, note.freq, note.time, AUDIO.success.noteLength);
      });
  }

  /**
   * Play error sound effect
   */
  function playErrorSound() {
    playSound({
      frequency: AUDIO.error.frequency,
      duration: AUDIO.error.duration,
      type: 'square',
      gain: 0.3
    });
  }

  /**
   * Play a single note
   */
  function playNote(audioContext, frequency, startTime, duration) {
    try {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime + startTime);
      
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime + startTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + startTime + duration
      );
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.start(audioContext.currentTime + startTime);
      oscillator.stop(audioContext.currentTime + startTime + duration);
    } catch (e) {
      console.error('Failed to play note:', e);
    }
  }

  /**
   * Play a basic sound effect
   */
  function playSound({ frequency, duration, type = 'square', gain = 0.3 }) {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      
      gainNode.gain.setValueAtTime(gain, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + duration
      );
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration);
    } catch (e) {
      console.error('Failed to play sound:', e);
    }
  }

  // Initialize the extension
  init();
});
