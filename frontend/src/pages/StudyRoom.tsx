import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  FileUp,
  HelpCircle,
  ListChecks,
  MessageSquareText,
  PlayCircle,
  RefreshCcw,
  Send,
} from 'lucide-react';
import {
  extractConcepts,
  generateQuestions,
  getSessionReport,
  requestHint,
  submitAnswer,
  submitSelfExplanation,
  uploadMaterial,
} from '../api/client';
import type {
  AnswerEvaluationResponse,
  Concept,
  HintResponse,
  MaterialUploadResponse,
  Question,
  SelfExplanationResponse,
  SessionReportResponse,
} from '../types/api';
import './StudyRoom.css';

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

export const StudyRoom = () => {
  const [file, setFile] = useState<File | null>(null);
  const [material, setMaterial] = useState<MaterialUploadResponse | null>(null);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [selectedConcept, setSelectedConcept] = useState<Concept | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [answerStartedAt, setAnswerStartedAt] = useState<number | null>(null);
  const [answer, setAnswer] = useState<AnswerEvaluationResponse | null>(null);
  const [hints, setHints] = useState<HintResponse[]>([]);
  const [selfExplanationText, setSelfExplanationText] = useState('');
  const [selfExplanation, setSelfExplanation] = useState<SelfExplanationResponse | null>(null);
  const [report, setReport] = useState<SessionReportResponse | null>(null);
  const [loadingLabel, setLoadingLabel] = useState('');
  const [error, setError] = useState('');

  const canRequestHint = Boolean(answer && hints.length < 5);
  const currentHintLevel = hints.length + 1;

  const steps = useMemo(
    () => [
      { label: '자료', done: Boolean(material) },
      { label: '개념', done: concepts.length > 0 },
      { label: '질문', done: questions.length > 0 },
      { label: '답변', done: Boolean(answer) },
      { label: '힌트', done: hints.length > 0 },
      { label: '설명', done: Boolean(selfExplanation) },
      { label: '리포트', done: Boolean(report) },
    ],
    [answer, concepts.length, hints.length, material, questions.length, report, selfExplanation],
  );

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

  const handleUpload = () =>
    runAction('자료 업로드 중', async () => {
      if (!file) {
        throw new Error('PDF 파일을 먼저 선택하세요.');
      }

      const uploaded = await uploadMaterial(file);
      setMaterial(uploaded);
      setConcepts([]);
      setSelectedConcept(null);
      setQuestions([]);
      setActiveQuestion(null);
      setAnswer(null);
      setHints([]);
      setSelfExplanation(null);
      setReport(null);
      setAnswerText('');
      setSelfExplanationText('');
    });

  const handleExtractConcepts = () =>
    runAction('핵심 개념 추출 중', async () => {
      if (!material) {
        throw new Error('먼저 자료를 업로드하세요.');
      }

      const extracted = await extractConcepts(material.id);
      setConcepts(extracted.concepts);
      setSelectedConcept(extracted.concepts[0] ?? null);
      setQuestions([]);
      setActiveQuestion(null);
      setAnswer(null);
      setHints([]);
      setSelfExplanation(null);
      setReport(null);
    });

  const handleGenerateQuestions = (concept: Concept) =>
    runAction('질문 생성 중', async () => {
      const generated = await generateQuestions(concept.id);
      setSelectedConcept(concept);
      setQuestions(generated.questions);
      setActiveQuestion(generated.questions[0] ?? null);
      setAnswerStartedAt(Date.now());
      setAnswer(null);
      setHints([]);
      setSelfExplanation(null);
      setReport(null);
      setAnswerText('');
      setSelfExplanationText('');
    });

  const handleSubmitAnswer = () =>
    runAction('답변 평가 중', async () => {
      if (!activeQuestion) {
        throw new Error('먼저 질문을 생성하세요.');
      }
      if (!answerText.trim()) {
        throw new Error('답변을 입력하세요.');
      }

      const responseTime = answerStartedAt ? (Date.now() - answerStartedAt) / 1000 : undefined;
      const evaluated = await submitAnswer(activeQuestion.id, answerText, responseTime);
      setAnswer(evaluated);
      setHints([]);
      setReport(null);
    });

  const handleRequestHint = () =>
    runAction(`Level ${currentHintLevel} 힌트 요청 중`, async () => {
      if (!answer) {
        throw new Error('답변 평가 후 힌트를 요청할 수 있습니다.');
      }

      const hint = await requestHint(answer.id, currentHintLevel);
      setHints((current) => [...current, hint]);
    });

  const handleSubmitSelfExplanation = () =>
    runAction('자기 설명 평가 중', async () => {
      if (!selectedConcept) {
        throw new Error('개념을 먼저 선택하세요.');
      }
      if (selfExplanationText.trim().length < 10) {
        throw new Error('자기 설명은 10자 이상 입력하세요.');
      }

      const evaluated = await submitSelfExplanation(selectedConcept.id, selfExplanationText);
      setSelfExplanation(evaluated);

      if (answer?.session_id) {
        const sessionReport = await getSessionReport(answer.session_id);
        setReport(sessionReport);
      }
    });

  const handleLoadReport = () =>
    runAction('리포트 조회 중', async () => {
      if (!answer?.session_id) {
        throw new Error('답변 평가 후 리포트를 조회할 수 있습니다.');
      }

      const sessionReport = await getSessionReport(answer.session_id);
      setReport(sessionReport);
    });

  return (
    <div className="study-room">
      <header className="study-header">
        <div>
          <h1>Brain Training Session</h1>
          <p className="subtitle">PDF에서 개념을 꺼내고, 답변과 힌트로 기억 회로를 훈련합니다.</p>
        </div>
        <div className="status-pill">
          <BrainCircuit size={18} />
          {loadingLabel || 'Ready'}
        </div>
      </header>

      <section className="step-strip glass-panel">
        {steps.map((step) => (
          <div className={`step-chip ${step.done ? 'done' : ''}`} key={step.label}>
            <CheckCircle2 size={16} />
            <span>{step.label}</span>
          </div>
        ))}
      </section>

      {error && (
        <div className="error-banner">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="study-grid">
        <section className="glass-panel workflow-panel">
          <div className="panel-title">
            <FileUp size={20} />
            <h2>자료 업로드</h2>
          </div>
          <label className="upload-box">
            <input
              accept="application/pdf"
              type="file"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <span>{file ? file.name : 'PDF 파일 선택'}</span>
          </label>
          <button className="glow-btn full-button" disabled={!file || Boolean(loadingLabel)} onClick={handleUpload}>
            <FileUp size={18} />
            업로드
          </button>

          {material && (
            <div className="result-box">
              <strong>{material.title}</strong>
              <span>{material.extracted_text_length.toLocaleString()}자 추출</span>
              <p>{material.preview}</p>
            </div>
          )}

          <button
            className="secondary-btn full-button"
            disabled={!material || Boolean(loadingLabel)}
            onClick={handleExtractConcepts}
          >
            <ListChecks size={18} />
            핵심 개념 추출
          </button>
        </section>

        <section className="glass-panel workflow-panel">
          <div className="panel-title">
            <ListChecks size={20} />
            <h2>개념 선택</h2>
          </div>
          <div className="concept-list">
            {concepts.length === 0 && <p className="muted">자료 업로드 후 핵심 개념을 추출하세요.</p>}
            {concepts.map((concept) => (
              <button
                className={`concept-item ${selectedConcept?.id === concept.id ? 'active' : ''}`}
                key={concept.id}
                onClick={() => setSelectedConcept(concept)}
              >
                <span>{concept.title}</span>
                <small>{concept.difficulty}</small>
              </button>
            ))}
          </div>
          {selectedConcept && (
            <div className="result-box compact">
              <strong>{selectedConcept.title}</strong>
              <p>{selectedConcept.description}</p>
              <button
                className="secondary-btn full-button"
                disabled={Boolean(loadingLabel)}
                onClick={() => handleGenerateQuestions(selectedConcept)}
              >
                <PlayCircle size={18} />
                질문 생성
              </button>
            </div>
          )}
        </section>

        <section className="glass-panel workflow-panel large-panel">
          <div className="panel-title">
            <MessageSquareText size={20} />
            <h2>능동 회상</h2>
          </div>
          {!activeQuestion && <p className="muted">개념을 선택하고 질문을 생성하세요.</p>}
          {activeQuestion && (
            <>
              <div className="question-box">
                <span>{activeQuestion.question_type}</span>
                <p>{activeQuestion.question_text}</p>
              </div>
              <textarea
                className="answer-input"
                placeholder="기억에서 직접 꺼낸 답변을 입력하세요."
                value={answerText}
                onChange={(event) => setAnswerText(event.target.value)}
              />
              <button
                className="glow-btn full-button"
                disabled={!answerText.trim() || Boolean(loadingLabel)}
                onClick={handleSubmitAnswer}
              >
                <Send size={18} />
                답변 평가
              </button>
            </>
          )}

          {answer && (
            <div className="evaluation-grid">
              <div className="metric-card">
                <span>정확도</span>
                <strong>{formatPercent(answer.correctness_score)}</strong>
              </div>
              <div className="metric-card">
                <span>오개념</span>
                <strong>{answer.misconception_detected ? '감지' : '없음'}</strong>
              </div>
              <div className="metric-card wide">
                <span>피드백</span>
                <p>{answer.feedback}</p>
              </div>
              {answer.missing_points && (
                <div className="metric-card wide warning">
                  <span>누락 개념</span>
                  <p>{answer.missing_points}</p>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="glass-panel workflow-panel">
          <div className="panel-title">
            <HelpCircle size={20} />
            <h2>힌트</h2>
          </div>
          <button className="secondary-btn full-button" disabled={!canRequestHint || Boolean(loadingLabel)} onClick={handleRequestHint}>
            <HelpCircle size={18} />
            Level {Math.min(currentHintLevel, 5)} 힌트
          </button>
          <div className="hint-list">
            {hints.length === 0 && <p className="muted">답변 평가 후 단계별 힌트를 요청하세요.</p>}
            {hints.map((hint) => (
              <div className="hint-card" key={hint.id}>
                <span>Level {hint.hint_level}</span>
                <p>{hint.hint_text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="glass-panel workflow-panel">
          <div className="panel-title">
            <RefreshCcw size={20} />
            <h2>자기 설명</h2>
          </div>
          <textarea
            className="answer-input small"
            placeholder="방금 개념을 자신의 언어로 다시 설명하세요."
            value={selfExplanationText}
            onChange={(event) => setSelfExplanationText(event.target.value)}
          />
          <button
            className="secondary-btn full-button"
            disabled={!selectedConcept || selfExplanationText.trim().length < 10 || Boolean(loadingLabel)}
            onClick={handleSubmitSelfExplanation}
          >
            <Send size={18} />
            설명 평가
          </button>
          {selfExplanation && (
            <div className="evaluation-grid compact-grid">
              <div className="metric-card">
                <span>정확성</span>
                <strong>{formatPercent(selfExplanation.accuracy_score)}</strong>
              </div>
              <div className="metric-card">
                <span>완전성</span>
                <strong>{formatPercent(selfExplanation.completeness_score)}</strong>
              </div>
              <div className="metric-card">
                <span>숙련도</span>
                <strong>{formatPercent(selfExplanation.mastery_level)}</strong>
              </div>
            </div>
          )}
        </section>

        <section className="glass-panel workflow-panel report-panel">
          <div className="panel-title">
            <BrainCircuit size={20} />
            <h2>세션 리포트</h2>
          </div>
          <button className="secondary-btn full-button" disabled={!answer?.session_id || Boolean(loadingLabel)} onClick={handleLoadReport}>
            <RefreshCcw size={18} />
            리포트 조회
          </button>
          {!report && <p className="muted">답변 평가 후 리포트를 조회할 수 있습니다.</p>}
          {report && (
            <div className="report-content">
              <div className="report-metrics">
                <div>
                  <span>평균 점수</span>
                  <strong>{formatPercent(report.average_score)}</strong>
                </div>
                <div>
                  <span>오개념</span>
                  <strong>{report.misconception_count}</strong>
                </div>
                <div>
                  <span>복습 추천</span>
                  <strong>{report.next_review_concepts.length}</strong>
                </div>
              </div>
              <div className="review-list">
                {report.next_review_concepts.map((concept) => (
                  <div className="review-item" key={concept.concept_id}>
                    <strong>{concept.title}</strong>
                    <p>{concept.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
