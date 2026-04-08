import { QUIZ_BANK, TITLE_BY_TYPE } from './quiz-data';
import { QuizScreen } from './quiz-screen';

export default function FairwayQuizScreen() {
  return <QuizScreen type="fairway" title={TITLE_BY_TYPE.fairway} questions={QUIZ_BANK.fairway} />;
}
