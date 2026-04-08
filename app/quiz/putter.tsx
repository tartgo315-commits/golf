import { QUIZ_BANK, TITLE_BY_TYPE } from './quiz-data';
import { QuizScreen } from './quiz-screen';

export default function PutterQuizScreen() {
  return <QuizScreen type="putter" title={TITLE_BY_TYPE.putter} questions={QUIZ_BANK.putter} />;
}
