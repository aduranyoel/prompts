/* eslint-disable import/no-commonjs */
const process = require('process');
const readline = require('readline');

/**
 * @typedef Question
 * @property {!string} type
 * @property {!string} name
 * @property {!string} message
 * @property {(string) => boolean} validate
 * @property {unknown} initial
 * @property {Array<Choice>} choices
 * @property {(Object) => boolean} show
 */

/**
 * @typedef Choice
 * @property {!string} title
 * @property {!string} value
 */

/**
 * @typedef PromptResult
 * @property {!string} message
 * @property {(string) => Promise<unknown>} handler
 */

/**
 * Prompt for a series of questions
 * @param {Array<Question>} questions Array of question objects
 * @returns {Promise<Object>} Object with values from user input
 */
async function prompts(questions = []) {
  const answers = {};
  const { stdin: input, stdout: output } = process;
  const rl = readline.createInterface({ input, output });
  const ask = questionPromise(rl);
  for (const question of questions) {
    try {
      if (typeof question.show === 'function' && !question.show(answers)) {
        continue;
      }
      answers[question.name] = await ask(question);
    } catch (e) {
      console.error(e);
      break;
    }
  }
  rl.close();
  return answers;
}

/**
 * Creates a Promise that displays a question, waits for user input, then resolve the answer
 * @param rl {readline.Interface}
 */
const questionPromise = (rl) => (question) =>
  new Promise((resolve, reject) => {
    getAnswerFor(question, rl).then(resolve).catch(reject);
  });

const types = {
  text: 'text',
  select: 'select',
  confirm: 'confirm',
};

const questionTypes = {
  [types.text]: textPrompt,
  [types.select]: selectPrompt,
  [types.confirm]: confirmPrompt,
};

const formatMessage = (message) => `${message}: `;

/**
 * Handles the answer for a question
 * @param question {Question}
 * @param rl {readline.Interface}
 */
function getAnswerFor(question, rl) {
  return new Promise((resolve, reject) => {
    const prompt = questionTypes[question.type];
    if (!prompt) {
      reject('Invalid question type');
      return;
    }
    const { message, handler } = prompt(question);
    rl.question(formatMessage(message), (value) => handler(value).then(resolve).catch(reject));
  });
}

/**
 * Trigger the question validator
 * @param question {Question}
 * @param answer {unknown}
 */
const validateQuestion = (question, answer) => {
  if (typeof question.validate === 'function' && !question.validate(answer)) {
    throw new Error(`Invalid input: ${answer}`);
  }
};

/* region Prompts */
/**
 * @param question {Question}
 * @returns {PromptResult}
 */
function textPrompt(question) {
  return {
    message: question.message,
    handler: async (answer) => {
      validateQuestion(question, answer);
      return answer;
    },
  };
}
/**
 * @param question {Question}
 * @returns {PromptResult}
 */
function confirmPrompt(question) {
  const defaultIndicator = Boolean(question.initial) ? '[Y/n]' : '[y/N]';
  const message = `${question.message} ${defaultIndicator}`;
  return {
    message,
    handler: async (answer) => {
      answer = answer || question.initial;
      validateQuestion(question, answer);
      if (typeof answer === 'string') {
        return /^y$/i.test(answer);
      }
      return Boolean(answer);
    },
  };
}
/**
 * @param question {Question}
 * @returns {PromptResult}
 */
function selectPrompt(question) {
  const choiceTitles = question.choices.map((c, i) => `${i + 1}. ${c.title}\n`).join``;
  const selectText = 'Select a option';
  const message = `${question.message}\n${choiceTitles}${selectText}`;
  return {
    message,
    handler: async (answer) => {
      const choice = question.choices[Number(answer) - 1];
      if (!choice) {
        throw new Error('Invalid choice');
      }
      validateQuestion(question, answer);
      return choice.value;
    },
  };
}
/* endregion Prompts */

module.exports = Object.assign(prompts, { types });
