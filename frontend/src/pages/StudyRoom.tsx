import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  FileText,
  FileUp,
  HelpCircle,
  Loader2,
  MessageSquareText,
  Send,
} from 'lucide-react';
import {
  getMaterials,
  startMaterialStudy,
  submitAnswer,
  submitSelfExplanation,
  uploadMaterial,
} from '../api/client';
import type {
  AnswerEvaluationResponse,
  Concept,
  MaterialSummary,
  Question,
  SelfExplanationResponse,
} from '../types/api';
import './StudyRoom.css';

const HINT_BUDGET = 5;

type SupportEntry = {
  id: string;
  label: string;
  text: string;
};

type SessionAnswer = {
  score: number;
  misconception: boolean;
  hintsUsed: number;
};

type StuckOption = {
  label: string;
  build: (concept: Concept, question: Question) => string;
};

const questionTypeLabels: Record<string, string> = {
  definition: '개념 회상',
  comparison: '비교 설명',
  cause_effect: '원인과 결과',
  example: '예시 만들기',
  application: '적용하기',
  misconception: '오개념 점검',
  misconception_check: '오개념 점검',
};

const stuckOptions: StuckOption[] = [
  {
    label: '단어가 기억나지 않아요',
    build: (concept: Concept, question: Question) =>
      `키워드 단서: ${keywordCue(concept, question)}. 이 단어가 질문에서 어떤 역할을 하는지 먼저 떠올려보세요.`,
  },
  {
    label: '개념은 아는데 설명이 안 돼요',
    build: (concept: Concept) =>
      `문장 시작: "${concept.title}은/는 ..."으로 시작한 뒤, 왜 중요한지 한 문장을 덧붙여보세요.`,
  },
  {
    label: '질문이 이해되지 않아요',
    build: (_concept: Concept, question: Question) =>
      `질문을 더 작게 나누면: "${question.question_text}"에서 먼저 묻는 대상과 설명해야 할 관계를 분리해보세요.`,
  },
  {
    label: '두 개념이 헷갈려요',
    build: (concept: Concept) =>
      `${concept.title}과/와 헷갈리는 개념을 하나 적고, "공통점 1개, 차이점 1개"만 먼저 비교해보세요.`,
  },
];

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

function keywordCue(concept: Concept, question: Question): string {
  const source = `${concept.title} ${concept.description} ${question.question_text}`;
  const tokens = source
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3);

  return tokens.slice(0, 3).join(', ') || concept.title;
}

function buildHint(level: number, concept: Concept, question: Question): string {
  const cue = keywordCue(concept, question);
  const typeLabel = questionTypeLabels[question.question_type] ?? question.question_type;
  const templates: Record<number, string> = {
    1: `작은 방향만 볼게요. 이 질문은 ${typeLabel} 문제이고, 먼저 "${concept.title}"의 핵심 역할을 떠올리면 됩니다.`,
    2: `관련 개념 단서: ${cue}. 이 단어들이 서로 어떤 순서나 관계로 이어지는지 생각해보세요.`,
    3: '답변 구조를 잡아보세요. "무엇인가 → 왜 중요한가 → 어떤 결과가 생기는가" 순서로 한 문장씩 쓰면 됩니다.',
    4: `조금 더 강한 발판입니다. ${concept.title}을/를 설명할 때 빠지면 안 되는 조건이나 비교 지점을 하나 적어보세요.`,
    5: '거의 다 왔습니다. 정답을 보기 전에 핵심 키워드 2개를 넣어 짧은 설명문으로 다시 구성해보세요.',
  };

  return templates[level] ?? templates[1];
}

export const StudyRoom = () => {
  const [materials, setMaterials] = useState<MaterialSummary[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [material, setMaterial] = useState<MaterialSummary | null>(null);
  const [concept, setConcept] = useState<Concept | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [answerStartedAt, setAnswerStartedAt] = useState<number | null>(null);
  const [answer, setAnswer] = useState<AnswerEvaluationResponse | null>(null);
  const [selfExplanationText, setSelfExplanationText] = useState('');
  const [selfExplanation, setSelfExplanation] = useState<SelfExplanationResponse | null>(null);
  const [supportEntries, setSupportEntries] = useState<SupportEntry[]>([]);
  const [supportUsedTotal, setSupportUsedTotal] = useState(0);
  const [sessionAnswers, setSessionAnswers] = useState<SessionAnswer[]>([]);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState('');
  const [error, setError] = useState('');

  const activeQuestion = questions[questionIndex] ?? null;
  const questionSupportUsed = supportEntries.length;
  const remainingHints = Math.max(0, HINT_BUDGET - supportUsedTotal);
  const canUseSupport = Boolean(concept && activeQuestion && !answer && remainingHints > 0 && !sessionComplete);
  const progressLabel = questions.length > 0 ? `${Math.min(questionIndex + 1, questions.length)} / ${questions.length}` : '0 / 0';
  const averageScore = useMemo(() => {
    if (sessionAnswers.length === 0) {
      return 0;
    }
    return sessionAnswers.reduce((sum, item) => sum + item.score, 0) / sessionAnswers.length;
  }, [sessionAnswers]);

  useEffect(() => {
    let mounted = true;

    async function loadMaterials() {
      try {
        const response = await getMaterials();
        if (mounted) {
          setMaterials(response.materials);
        }
      } catch {
        if (mounted) {
          setMaterials([]);
        }
      }
    }

    void loadMaterials();

    return () => {
      mounted = false;
    };
  }, []);

  const runAction = async (label: string, action: () => Promise<void>) => {
    setError('');
    setLoadingLabel(label);
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '요청 처리 중 오류가 발생했습니다.');
    } finally {
      setLoadingLabel('');
    }
  };

  const beginStudy = async (materialId: number) => {
    const response = await startMaterialStudy(materialId);
    setMaterial(response.material);
    setConcept(response.concept);
    setQuestions(response.questions);
    setQuestionIndex(0);
    setSessionId(null);
    setAnswerText('');
    setAnswer(null);
    setSelfExplanationText('');
    setSelfExplanation(null);
    setSupportEntries([]);
    setSupportUsedTotal(0);
    setSessionAnswers([]);
    setSessionComplete(false);
    setAnswerStartedAt(Date.now());
  };

  const handleUploadAndStart = () =>
    runAction('자료 분석 중', async () => {
      if (!file) {
        throw new Error('PDF 파일을 먼저 선택하세요.');
      }

      const uploaded = await uploadMaterial(file);
      const summary: MaterialSummary = {
        id: uploaded.id,
        title: uploaded.title,
        extracted_text_length: uploaded.extracted_text_length,
        preview: uploaded.preview,
        created_at: uploaded.created_at,
      };
      setMaterials((current) => [summary, ...current.filter((item) => item.id !== summary.id)]);
      await beginStudy(uploaded.id);
    });

  const handleStartExisting = (materialId: number) =>
    runAction('학습 준비 중', async () => {
      await beginStudy(materialId);
    });

  const useHint = () => {
    if (!concept || !activeQuestion || !canUseSupport) {
      return;
    }

    const level = supportUsedTotal + 1;
    setSupportEntries((current) => [
      ...current,
      {
        id: `hint-${Date.now()}`,
        label: `힌트 ${level}`,
        text: buildHint(level, concept, activeQuestion),
      },
    ]);
    setSupportUsedTotal((current) => current + 1);
  };

  const useStuckOption = (option: (typeof stuckOptions)[number]) => {
    if (!concept || !activeQuestion || !canUseSupport) {
      return;
    }

    setSupportEntries((current) => [
      ...current,
      {
        id: `stuck-${Date.now()}`,
        label: option.label,
        text: option.build(concept, activeQuestion),
      },
    ]);
    setSupportUsedTotal((current) => current + 1);
  };

  const handleSubmitAnswer = () =>
    runAction('답변 평가 중', async () => {
      if (!activeQuestion) {
        throw new Error('먼저 질문을 준비하세요.');
      }
      if (!answerText.trim()) {
        throw new Error('답변을 입력하세요.');
      }

      const responseTime = answerStartedAt ? (Date.now() - answerStartedAt) / 1000 : undefined;
      const evaluated = await submitAnswer(activeQuestion.id, answerText, responseTime, sessionId);
      setAnswer(evaluated);
      setSessionId(evaluated.session_id);
      setSessionAnswers((current) => [
        ...current,
        {
          score: evaluated.correctness_score,
          misconception: evaluated.misconception_detected,
          hintsUsed: questionSupportUsed,
        },
      ]);
    });

  const handleSubmitSelfExplanation = () =>
    runAction('설명 평가 중', async () => {
      if (!concept) {
        throw new Error('개념을 먼저 준비하세요.');
      }
      if (selfExplanationText.trim().length < 10) {
        throw new Error('자기 설명은 10자 이상 입력하세요.');
      }

      const evaluated = await submitSelfExplanation(concept.id, selfExplanationText);
      setSelfExplanation(evaluated);
    });

  const moveNext = () => {
    if (questionIndex + 1 >= questions.length) {
      setSessionComplete(true);
      return;
    }

    setQuestionIndex((current) => current + 1);
    setAnswerText('');
    setAnswer(null);
    setSelfExplanationText('');
    setSelfExplanation(null);
    setSupportEntries([]);
    setAnswerStartedAt(Date.now());
  };

  const startOver = () => {
    if (!material) {
      return;
    }
    void handleStartExisting(material.id);
  };

  return (
    <div className="study-room">
      <header className="study-header">
        <div>
          <h1>Study</h1>
          <p className="subtitle">자료를 읽기 전에 먼저 기억에서 꺼내보는 능동 회상 학습실입니다.</p>
        </div>
        <div className="status-pill">
          {loadingLabel ? <Loader2 size={18} className="spin-icon" /> : <BrainCircuit size={18} />}
          {loadingLabel || '준비됨'}
        </div>
      </header>

      {error && (
        <div className="error-banner">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      <section className="study-shell glass-panel">
        <div className="study-topline">
          <div>
            <span>현재 자료</span>
            <strong>{material?.title ?? '자료를 선택하세요'}</strong>
          </div>
          <div>
            <span>진행</span>
            <strong>{progressLabel}</strong>
          </div>
          <div>
            <span>남은 힌트</span>
            <strong>{remainingHints} / {HINT_BUDGET}</strong>
          </div>
        </div>

        {!activeQuestion && (
          <div className="study-start-grid">
            <section className="study-start-panel">
              <div className="panel-title">
                <FileUp size={20} />
                <h2>PDF 업로드</h2>
              </div>
              <label className="upload-box">
                <input
                  accept="application/pdf"
                  type="file"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
                <span>{file ? file.name : 'PDF 파일 선택'}</span>
              </label>
              <button className="glow-btn full-button" disabled={!file || Boolean(loadingLabel)} onClick={handleUploadAndStart}>
                <FileUp size={18} />
                업로드하고 시작
              </button>
            </section>

            <section className="study-start-panel">
              <div className="panel-title">
                <FileText size={20} />
                <h2>기존 자료</h2>
              </div>
              <div className="material-list">
                {materials.length === 0 && <p className="muted">아직 업로드한 자료가 없습니다.</p>}
                {materials.map((item) => (
                  <button
                    className="material-item"
                    disabled={Boolean(loadingLabel)}
                    key={item.id}
                    onClick={() => handleStartExisting(item.id)}
                    type="button"
                  >
                    <strong>{item.title}</strong>
                    <span>{item.extracted_text_length.toLocaleString()}자</span>
                    <p>{item.preview || '미리보기가 없습니다.'}</p>
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeQuestion && !sessionComplete && (
          <div className="recall-flow">
            <section className="question-card">
              <div className="question-meta-row">
                <span>{questionTypeLabels[activeQuestion.question_type] ?? activeQuestion.question_type}</span>
                <span>{concept?.title}</span>
              </div>
              <h2>{activeQuestion.question_text}</h2>
            </section>

            <section className="answer-block">
              <textarea
                className="answer-input"
                disabled={Boolean(answer)}
                placeholder="정답을 보기 전에 기억에서 직접 꺼낸 답을 적어보세요."
                value={answerText}
                onChange={(event) => setAnswerText(event.target.value)}
              />
              <div className="action-row">
                <button className="secondary-btn" disabled={!canUseSupport} onClick={useHint} type="button">
                  <HelpCircle size={18} />
                  Hint
                </button>
                <button
                  className="glow-btn"
                  disabled={!answerText.trim() || Boolean(answer) || Boolean(loadingLabel)}
                  onClick={handleSubmitAnswer}
                  type="button"
                >
                  <Send size={18} />
                  답변 제출
                </button>
              </div>
            </section>

            {!answer && (
              <section className="stuck-panel">
                <div className="panel-title">
                  <MessageSquareText size={19} />
                  <h2>막혔나요?</h2>
                </div>
                <div className="stuck-grid">
                  {stuckOptions.map((option) => (
                    <button
                      className="stuck-option"
                      disabled={!canUseSupport}
                      key={option.label}
                      onClick={() => useStuckOption(option)}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {supportEntries.length > 0 && (
              <section className="support-list">
                {supportEntries.map((entry) => (
                  <article className="support-card" key={entry.id}>
                    <span>{entry.label}</span>
                    <p>{entry.text}</p>
                  </article>
                ))}
              </section>
            )}

            {answer && (
              <section className="feedback-panel">
                <div className="feedback-summary">
                  <div>
                    <span>회상 정확도</span>
                    <strong>{formatPercent(answer.correctness_score)}</strong>
                  </div>
                  <div>
                    <span>오개념 위험</span>
                    <strong>{answer.misconception_detected ? '있음' : '낮음'}</strong>
                  </div>
                </div>
                <div className="short-feedback">
                  <CheckCircle2 size={20} />
                  <p>{answer.feedback}</p>
                </div>
                {answer.missing_points && (
                  <p className="missing-point">보완할 지점: {answer.missing_points}</p>
                )}
              </section>
            )}

            {answer && (
              <section className="self-explain-panel">
                <h2>이 개념을 자신의 말로 설명해보세요</h2>
                <textarea
                  className="answer-input small"
                  placeholder="예: 이 개념은 ... 때문에 중요하고, ...와 연결됩니다."
                  value={selfExplanationText}
                  onChange={(event) => setSelfExplanationText(event.target.value)}
                />
                <div className="action-row">
                  <button
                    className="secondary-btn"
                    disabled={selfExplanationText.trim().length < 10 || Boolean(selfExplanation) || Boolean(loadingLabel)}
                    onClick={handleSubmitSelfExplanation}
                    type="button"
                  >
                    <Send size={18} />
                    설명 제출
                  </button>
                  <button
                    className="glow-btn"
                    disabled={!selfExplanation || Boolean(loadingLabel)}
                    onClick={moveNext}
                    type="button"
                  >
                    <ArrowRight size={18} />
                    {questionIndex + 1 >= questions.length ? '결과 보기' : '다음 질문'}
                  </button>
                </div>
                {selfExplanation && (
                  <div className="explanation-result">
                    <span>설명 품질 {formatPercent((selfExplanation.accuracy_score + selfExplanation.completeness_score) / 2)}</span>
                    <p>{selfExplanation.feedback}</p>
                  </div>
                )}
              </section>
            )}
          </div>
        )}

        {sessionComplete && (
          <section className="session-result">
            <BrainCircuit size={42} />
            <h2>세션 결과</h2>
            <div className="result-metrics">
              <div>
                <span>답변 수</span>
                <strong>{sessionAnswers.length}</strong>
              </div>
              <div>
                <span>평균 회상</span>
                <strong>{formatPercent(averageScore)}</strong>
              </div>
              <div>
                <span>사용한 힌트</span>
                <strong>{supportUsedTotal}</strong>
              </div>
              <div>
                <span>오개념 위험</span>
                <strong>{sessionAnswers.some((item) => item.misconception) ? '점검 필요' : '낮음'}</strong>
              </div>
            </div>
            <button className="glow-btn" onClick={startOver} type="button">
              다시 학습하기
            </button>
          </section>
        )}
      </section>
    </div>
  );
};
