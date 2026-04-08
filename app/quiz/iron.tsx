import { QUIZ_BANK, TITLE_BY_TYPE } from './quiz-data';
import { QuizScreen } from './quiz-screen';

export default function IronQuizScreen() {
  return <QuizScreen type="iron" title={TITLE_BY_TYPE.iron} questions={QUIZ_BANK.iron} />;
}
