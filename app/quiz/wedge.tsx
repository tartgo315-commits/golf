import { QUIZ_BANK, TITLE_BY_TYPE } from './quiz-data';
import { QuizScreen } from './quiz-screen';

export default function WedgeQuizScreen() {
  return <QuizScreen type="wedge" title={TITLE_BY_TYPE.wedge} questions={QUIZ_BANK.wedge} />;
}
