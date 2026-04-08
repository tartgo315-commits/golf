import { QUIZ_BANK, TITLE_BY_TYPE } from './quiz-data';
import { QuizScreen } from './quiz-screen';

export default function DriverQuizScreen() {
  return <QuizScreen type="driver" title={TITLE_BY_TYPE.driver} questions={QUIZ_BANK.driver} />;
}
