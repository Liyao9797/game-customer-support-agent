(function initFeedbackStore(global) {
  const STORAGE_KEY = "tyddz_feedbacks";

  function readFeedbacks() {
    try {
      return JSON.parse(global.localStorage?.getItem(STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function writeFeedbacks(feedbacks) {
    global.localStorage?.setItem(STORAGE_KEY, JSON.stringify(feedbacks));
  }

  function addFeedback(feedback) {
    const feedbacks = readFeedbacks();
    feedbacks.push(feedback);
    writeFeedbacks(feedbacks);
    return feedbacks;
  }

  function updateFeedback(feedbackId, updater) {
    const feedbacks = readFeedbacks();
    const index = feedbacks.findIndex((item) => item.feedback_id === feedbackId);
    if (index < 0) return { feedbacks, feedback: null };
    feedbacks[index] = updater(feedbacks[index]);
    writeFeedbacks(feedbacks);
    return { feedbacks, feedback: feedbacks[index] };
  }

  function findFeedback(feedbackId) {
    return readFeedbacks().find((item) => item.feedback_id === feedbackId) || null;
  }

  function nextSerial() {
    return readFeedbacks().length + 1;
  }

  global.FeedbackStore = {
    readFeedbacks,
    writeFeedbacks,
    addFeedback,
    updateFeedback,
    findFeedback,
    nextSerial,
  };

  if (typeof module !== "undefined") {
    module.exports = global.FeedbackStore;
  }
})(typeof window !== "undefined" ? window : globalThis);
