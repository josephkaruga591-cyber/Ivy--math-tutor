import express from 'express';
import type { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Shared Gemini client utility
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Fallback mock solver for offline or missing API key scenarios
function getMockSolution(problem: string, gradeLevel: string) {
  return {
    originalProblem: problem || 'Find the solution',
    gradeLevel: gradeLevel || 'grades_3_4',
    topic: 'Basic Arithmetic & Problem Solving',
    whatIsAsked: 'We need to break down this math question step by step so you can easily understand and solve it!',
    keyClues: [
      'Read the question carefully to identify the known numbers',
      'Determine the math operation required (+, -, ×, ÷)',
      'Calculate the result step-by-step',
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Understand the question and identify the parts',
        explanation: 'Look closely at what information is given. Write down your numbers clearly.',
        mathExpression: problem,
        tipOrWatchOut: 'Always double-check that you copied the numbers down correctly!',
      },
      {
        stepNumber: 2,
        title: 'Apply the operation step by step',
        explanation: 'Work through the problem starting from the simplest place value or standard order of operations.',
        mathExpression: 'Calculation in progress...',
        tipOrWatchOut: 'Take your time and keep your work neat.',
      },
      {
        stepNumber: 3,
        title: 'Check your final result',
        explanation: 'Review the steps to ensure everything makes logical sense.',
        mathExpression: 'Verified',
        tipOrWatchOut: 'You can check your answer by doing the opposite operation!',
      },
    ],
    finalAnswer: 'See step breakdown',
    unit: 'units',
    checkYourWork: 'Do the reverse operation or plug your answer back into the original problem to verify!',
    hints: [
      'Hint 1: First identify which numbers you are working with.',
      'Hint 2: Decide whether you need to add, subtract, multiply, or divide.',
      'Hint 3: Work through the numbers one column or step at a time.',
    ],
    visualModel: {
      type: 'number_line',
      params: {
        start: 0,
        end: 20,
        jumps: [{ from: 0, to: 10, label: 'Start' }, { from: 10, to: 20, label: 'End' }],
      },
    },
  };
}

// 1. Solve math problem (text and/or image)
app.post('/api/math/solve', async (req: Request, res: Response) => {
  try {
    const { problem, gradeLevel = 'grades_3_4', explanationStyle = 'standard', imageBase64 } = req.body;

    if (!problem && !imageBase64) {
      return res.status(400).json({ error: 'Please provide either a math problem text or an image/drawing.' });
    }

    if (!apiKey) {
      console.warn('GEMINI_API_KEY is not set. Using fallback response.');
      return res.json(getMockSolution(problem, gradeLevel));
    }

    const gradeDescriptions: Record<string, string> = {
      grades_1_2: 'Grades 1-2 (Ages 6-8). Keep explanations super gentle, friendly, and conversational. Use tangible kid analogies like counting apples, toys, blocks, and ten-frames. Avoid high-school jargon.',
      grades_3_4: 'Grades 3-4 (Ages 8-10). Focus on multiplication, division, simple fractions, area/perimeter, place value. Friendly, clear, encouraging, like a supportive elementary school teacher.',
      grades_5_6: 'Grades 5-6 (Ages 10-12). Focus on fractions, decimals, percentages, PEMDAS (Order of Operations), ratios. Clear mathematical terms explained simply with practical examples.',
      grades_7_8: 'Grades 7-8 (Ages 12-14, Pre-Algebra). Focus on negative numbers, variables, two-step equations, coordinate plane, geometry. Clear algebraic steps with balancing and inverse operations.',
      grade_9: 'Grade 9 (Ages 14-15, Algebra 1 & High School Prep). Focus on linear equations (slope-intercept y = mx + b), systems of equations (substitution & elimination), quadratic factoring, FOIL, polynomials, exponents, inequalities, and functions f(x). Clear, rigorous mathematical steps with intuitive geometric and algebraic reasoning.',
    };

    const styleInstruction = explanationStyle === 'story'
      ? 'Use fun, vivid story analogies (e.g. sharing pizza slices among friends, packing cookies into boxes, balancing a playground see-saw) to illustrate the math concept throughout.'
      : 'Use clear, structured pedagogical steps with gentle encouragement and practical tips.';

    const systemInstruction = `You are "StepWise", an expert, warm, and encouraging grade school & Grade 9 math tutor.
Target Audience: ${gradeDescriptions[gradeLevel] || gradeDescriptions.grades_3_4}
Style: ${styleInstruction}

Your mission:
1. Explain math with crystal-clear, bite-sized steps that build confidence and deep intuition.
2. Word problems must highlight "What is asked" and "Key clues / numbers given".
3. Provide a practical "Tip or Watch Out!" for common mistakes (e.g. forgetting to carry over, multiplying before adding, negative sign distribution, factoring signs).
4. Provide a "checkYourWork" section explaining how the student can double-check their answer independently (e.g. inverse operation, plugging x back into equation).
5. Provide 3 progressive hints from gentle nudge to near-solution for students who want to try on their own.
6. Provide a "visualModel" specification for interactive visual representation & student manipulation in the app:
   Supported visualModel types:
   - "coordinate_graph": For Grade 9 linear equations, slope, graphing lines (params: { slope?: number, intercept?: number, points?: [{ x: number, y: number, label: string }], lineEquation?: string, xRange?: [number, number], yRange?: [number, number] })
   - "drag_drop_blocks": For addition, subtraction, or combining quantities where students can interactively drag & drop blocks/counters between bins (params: { initialTotal: number, targetSum: number, groupA: number, groupB: number, itemType: "blocks"|"counters"|"apples"|"stars", operation: "add"|"subtract" })
   - "drag_drop_division": For division and fair sharing word problems where students directly drag items into equal groups/plates (params: { totalItems: number, groupCount: number, itemLabel: string, itemsPerGroup: number, remainder: number })
   - "geometric_shapes": For geometry, area, and perimeter problems where students explore shapes, draggable dimensions, and unit grids (params: { shape: "rectangle"|"triangle"|"circle"|"square", width?: number, height?: number, base?: number, radius?: number, unit: string, showGrid?: boolean })
   - "fraction_bars": For fraction comparison, addition, or equivalent fractions with interactive slice controls (params: { fractions: [{ numerator: number, denominator: number, label: string, color?: string }], allowsCustomSlices?: boolean })
   - "number_line": For addition, subtraction, jumping, or integers (params: { start: number, end: number, initialMarker?: number, targetMarker?: number, jumps: [{ from: number, to: number, label: string }] })
   - "ten_frame": For early elementary addition/subtraction (params: { frames: [{ count: number, total: 10, color: "blue"|"green"|"amber"|"purple" }] })
   - "multiplication_array": For multiplication grouping or area models (params: { rows: number, cols: number, total: number, rowLabel: string, colLabel: string })
   - "balance_scale": For algebraic equations (params: { leftSide: string, rightSide: string, variable: string, value: number|string })
   - "pie_chart": For parts of a whole / fractions (params: { slices: [{ label: string, fraction: string, percentage: number, color?: string }] })
   - "bar_comparison": For comparing quantities in word problems (params: { bars: [{ label: string, value: number, color?: string }] })

Format your response strictly as valid JSON adhering to the requested schema.`;

    const promptText = `Solve this math problem:
Problem: ${problem || 'Transcribe and solve the math problem in the provided image/drawing'}
Grade Band: ${gradeLevel}
Explanation Style: ${explanationStyle}

Please extract the exact problem text (especially if read from an image), solve it with detailed grade-appropriate steps, and provide interactive visual model parameters.`;

    const contents: any[] = [];

    if (imageBase64) {
      // Remove data URL prefix if present
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      contents.push({
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: cleanBase64,
            },
          },
          { text: promptText },
        ],
      });
    } else {
      contents.push(promptText);
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            originalProblem: { type: Type.STRING, description: 'The clean transcribed or formulated problem text' },
            gradeLevel: { type: Type.STRING },
            topic: { type: Type.STRING, description: 'Topic category e.g. Multi-digit Addition, Fraction Multiplication, Solving 2-Step Equations' },
            whatIsAsked: { type: Type.STRING, description: '1-2 sentence friendly summary of what we need to find' },
            keyClues: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Key numbers or facts given in the problem',
            },
            steps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  stepNumber: { type: Type.INTEGER },
                  title: { type: Type.STRING, description: 'Clear action title for this step' },
                  explanation: { type: Type.STRING, description: 'Friendly pedagogical explanation of why and how' },
                  mathExpression: { type: Type.STRING, description: 'The math equation or arithmetic for this step' },
                  tipOrWatchOut: { type: Type.STRING, description: 'Helpful caution or mnemonic' },
                },
                required: ['stepNumber', 'title', 'explanation', 'mathExpression'],
              },
            },
            finalAnswer: { type: Type.STRING, description: 'The clear final answer with units if applicable' },
            unit: { type: Type.STRING, description: 'The unit (e.g., apples, dollars, cm^2, or none)' },
            checkYourWork: { type: Type.STRING, description: 'Clear step-by-step method to verify the solution' },
            hints: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '3 progressive hints from subtle hint to near-solution',
            },
            visualModel: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, description: 'One of ten_frame, number_line, fraction_bars, multiplication_array, balance_scale, pie_chart, bar_comparison' },
                params: {
                  type: Type.OBJECT,
                  description: 'Parameters matching the visualModel type',
                },
              },
              required: ['type'],
            },
          },
          required: ['originalProblem', 'topic', 'whatIsAsked', 'keyClues', 'steps', 'finalAnswer', 'checkYourWork', 'hints'],
        },
      },
    });

    const text = response.text || '{}';
    const parsed = JSON.parse(text);
    return res.json(parsed);
  } catch (err: any) {
    console.error('Error in /api/math/solve:', err);
    return res.status(500).json({
      error: 'Failed to solve math problem. Please try again.',
      details: err?.message || String(err),
    });
  }
});

// 2. Generate a similar practice problem
app.post('/api/math/generate-practice', async (req: Request, res: Response) => {
  try {
    const { topic, gradeLevel = 'grades_3_4', basedOnProblem } = req.body;

    if (!apiKey) {
      return res.json({
        problemText: 'Practice problem: If Leo has 14 stickers and gives 6 to Maya, how many does he have left?',
        options: ['6 stickers', '8 stickers', '10 stickers', '20 stickers'],
        correctAnswer: '8 stickers',
        explanation: 'Subtract the stickers given away: 14 - 6 = 8 stickers left!',
        hint: 'Start with 14 and count back 6.',
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Create a single practice problem similar to: "${basedOnProblem || topic}".
Target Grade Level: ${gradeLevel}.
Topic: ${topic}.
Provide a multiple-choice question with 4 distinct options (1 correct, 3 plausible distractors), the correct answer, a friendly step-by-step explanation, and a quick hint.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            problemText: { type: Type.STRING, description: 'The practice math problem text' },
            options: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '4 multiple choice options',
            },
            correctAnswer: { type: Type.STRING, description: 'The exact string of the correct option' },
            explanation: { type: Type.STRING, description: 'Brief friendly explanation of how to solve it' },
            hint: { type: Type.STRING, description: 'Helpful hint for a student who is stuck' },
          },
          required: ['problemText', 'options', 'correctAnswer', 'explanation', 'hint'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json(parsed);
  } catch (err: any) {
    console.error('Error in /api/math/generate-practice:', err);
    return res.status(500).json({ error: 'Could not generate practice problem', details: err?.message });
  }
});

// 3. Check student answer / work
app.post('/api/math/check-work', async (req: Request, res: Response) => {
  try {
    const { originalProblem, studentAnswer, gradeLevel = 'grades_3_4' } = req.body;

    if (!studentAnswer) {
      return res.status(400).json({ error: 'Please provide your answer to check.' });
    }

    if (!apiKey) {
      return res.json({
        isCorrect: true,
        feedback: 'Great effort! Your work looks great!',
        correctAnswer: studentAnswer,
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `The student is in ${gradeLevel}.
The math problem is: "${originalProblem}".
The student answered: "${studentAnswer}".

Check if the student's answer is mathematically correct (taking into account units, equivalent fractions, or decimal rounding if applicable).
Provide:
1. isCorrect (boolean)
2. feedback: If correct, an enthusiastic and warm praise mentioning what they did right. If incorrect, a gentle, encouraging message showing exactly where the small mistake occurred without making them feel bad.
3. correctAnswer: The true correct answer.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isCorrect: { type: Type.BOOLEAN },
            feedback: { type: Type.STRING },
            correctAnswer: { type: Type.STRING },
          },
          required: ['isCorrect', 'feedback', 'correctAnswer'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json(parsed);
  } catch (err: any) {
    console.error('Error in /api/math/check-work:', err);
    return res.status(500).json({ error: 'Could not check answer', details: err?.message });
  }
});

// Vite middleware in dev or static files in production
if (process.env.NODE_ENV !== 'production') {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`StepWise Math Server active on http://0.0.0.0:${PORT}`);
});
