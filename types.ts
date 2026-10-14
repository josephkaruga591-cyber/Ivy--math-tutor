export type GradeLevel = 'grades_1_2' | 'grades_3_4' | 'grades_5_6' | 'grades_7_8' | 'grade_9';

export type ExplanationStyle = 'standard' | 'story';

export interface MathStep {
  stepNumber: number;
  title: string;
  explanation: string;
  mathExpression: string;
  tipOrWatchOut?: string;
}

export interface VisualModelParams {
  // coordinate_graph (Grade 9 linear equations, slope y = mx + b, points)
  slope?: number;
  intercept?: number;
  points?: Array<{ x: number; y: number; label?: string }>;
  lineEquation?: string;
  xRange?: [number, number];
  yRange?: [number, number];

  // drag_drop_blocks (interactive drag/click block manipulation for addition/subtraction)
  initialTotal?: number;
  targetSum?: number;
  groupA?: number;
  groupB?: number;
  itemType?: 'blocks' | 'counters' | 'apples' | 'stars' | string;
  operation?: 'add' | 'subtract' | string;

  // drag_drop_division (interactive fair sharing & division into equal plates/groups)
  totalItems?: number;
  groupCount?: number;
  itemLabel?: string;
  itemsPerGroup?: number;
  remainder?: number;

  // geometric_shapes (interactive dimension sliders, area/perimeter, unit grid)
  shape?: 'rectangle' | 'triangle' | 'circle' | 'square' | string;
  width?: number;
  height?: number;
  base?: number;
  radius?: number;
  unit?: string;
  showGrid?: boolean;

  // ten_frame
  frames?: Array<{ count: number; total: number; color?: string }>;
  
  // number_line (interactive drag jumps and frog hop tracking)
  start?: number;
  end?: number;
  initialMarker?: number;
  targetMarker?: number;
  jumps?: Array<{ from: number; to: number; label: string }>;

  // fraction_bars (interactive slice divider & comparison bars)
  fractions?: Array<{ numerator: number; denominator: number; label: string; color?: string }>;
  allowsCustomSlices?: boolean;

  // multiplication_array
  rows?: number;
  cols?: number;
  total?: number;
  rowLabel?: string;
  colLabel?: string;

  // balance_scale
  leftSide?: string;
  rightSide?: string;
  variable?: string;
  value?: number | string;

  // bar_comparison
  bars?: Array<{ label: string; value: number; color?: string }>;

  // pie_chart
  slices?: Array<{ label: string; fraction: string; percentage: number; color?: string }>;
}

export interface VisualModel {
  type:
    | 'coordinate_graph'
    | 'drag_drop_blocks'
    | 'drag_drop_division'
    | 'geometric_shapes'
    | 'fraction_bars'
    | 'number_line'
    | 'ten_frame'
    | 'multiplication_array'
    | 'balance_scale'
    | 'pie_chart'
    | 'bar_comparison'
    | string;
  params: VisualModelParams;
}

export interface MathSolution {
  id?: string;
  timestamp?: number;
  originalProblem: string;
  gradeLevel: GradeLevel;
  topic: string;
  whatIsAsked: string;
  keyClues: string[];
  steps: MathStep[];
  finalAnswer: string;
  unit?: string;
  checkYourWork: string;
  hints: string[];
  visualModel?: VisualModel;
}

export interface PracticeProblem {
  problemText: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  hint: string;
}

export interface CheckAnswerResult {
  isCorrect: boolean;
  feedback: string;
  correctAnswer: string;
}
