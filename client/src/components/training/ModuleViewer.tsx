import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  BookOpen, 
  CheckCircle, 
  Clock, 
  Target,
  Award,
  Play,
  ArrowRight,
  Users,
  Lightbulb
} from "lucide-react";
import { ModuleContent, getModuleContent } from "@/data/trainingContent";
import { LessonViewer } from "./LessonViewer";
import { useToast } from "@/hooks/use-toast";

interface ModuleViewerProps {
  moduleId: string;
  onComplete: (moduleId: string) => void;
  onExit: () => void;
}

export function ModuleViewer({ moduleId, onComplete, onExit }: ModuleViewerProps) {
  const [currentView, setCurrentView] = useState<'overview' | 'lesson' | 'assessment'>('overview');
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());
  const [assessmentAnswers, setAssessmentAnswers] = useState<Record<number, number>>({});
  const [showResults, setShowResults] = useState(false);
  const { toast } = useToast();

  const moduleContent = getModuleContent(moduleId);
  
  if (!moduleContent) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="p-8 text-center">
          <p className="text-lg text-muted-foreground">Module non trouvé</p>
          <Button onClick={onExit} className="mt-4">
            Retour aux modules
          </Button>
        </CardContent>
      </Card>
    );
  }

  const handleLessonComplete = (lessonId: string) => {
    const newCompleted = new Set(completedLessons);
    newCompleted.add(lessonId);
    setCompletedLessons(newCompleted);
    
    // Check if all lessons are completed
    if (newCompleted.size === moduleContent.lessons.length) {
      toast({
        title: "Toutes les leçons terminées !",
        description: "Vous pouvez maintenant passer à l'évaluation finale",
      });
    }
  };

  const handleNextLesson = () => {
    if (currentLessonIndex < moduleContent.lessons.length - 1) {
      setCurrentLessonIndex(currentLessonIndex + 1);
    } else {
      setCurrentView('assessment');
    }
  };

  const handlePreviousLesson = () => {
    if (currentLessonIndex > 0) {
      setCurrentLessonIndex(currentLessonIndex - 1);
    }
  };

  const handleAssessmentAnswer = (questionIndex: number, answerIndex: number) => {
    setAssessmentAnswers(prev => ({
      ...prev,
      [questionIndex]: answerIndex
    }));
  };

  const handleAssessmentSubmit = () => {
    const correctAnswers = moduleContent.finalAssessment.questions.filter(
      (question, index) => assessmentAnswers[index] === question.correct
    ).length;
    
    const score = (correctAnswers / moduleContent.finalAssessment.questions.length) * 100;
    
    setShowResults(true);
    
    if (score >= 80) {
      toast({
        title: "Félicitations !",
        description: `Module complété avec ${Math.round(score)}% de réussite`,
      });
      onComplete(moduleId);
    } else {
      toast({
        title: "Score insuffisant",
        description: `Score: ${Math.round(score)}%. Minimum requis: 80%`,
        variant: "destructive"
      });
    }
  };

  const progress = (completedLessons.size / moduleContent.lessons.length) * 100;

  // Overview View
  if (currentView === 'overview') {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <Card className="border-0 shadow-lg bg-gradient-to-r from-primary/5 to-primary/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-3xl">{moduleContent.title}</CardTitle>
                <p className="text-lg text-muted-foreground mt-2">{moduleContent.description}</p>
                <div className="flex items-center space-x-4 mt-4">
                  <Badge variant="outline" className="flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    {moduleContent.totalDuration}
                  </Badge>
                  <Badge variant="outline" className="flex items-center">
                    <BookOpen className="w-4 h-4 mr-1" />
                    {moduleContent.lessons.length} leçons
                  </Badge>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-primary">{Math.round(progress)}%</div>
                <div className="text-sm text-muted-foreground">Progression</div>
                <Progress value={progress} className="w-32 mt-2" />
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Prerequisites */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Lightbulb className="w-5 h-5 text-yellow-600" />
                <span>Prérequis</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {moduleContent.prerequisites.map((prereq, index) => (
                  <li key={index} className="flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                    <span>{prereq}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Learning Outcomes */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Target className="w-5 h-5 text-blue-600" />
                <span>Objectifs d'apprentissage</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {moduleContent.outcomes.map((outcome, index) => (
                  <li key={index} className="flex items-start">
                    <Target className="w-4 h-4 mr-2 mt-0.5 text-blue-600" />
                    <span>{outcome}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Lessons Overview */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Plan du module</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {moduleContent.lessons.map((lesson, index) => (
                <div
                  key={lesson.id}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    completedLessons.has(lesson.id)
                      ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
                      : 'bg-muted'
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      completedLessons.has(lesson.id)
                        ? 'bg-green-600 text-white'
                        : 'bg-primary text-primary-foreground'
                    }`}>
                      {completedLessons.has(lesson.id) ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        index + 1
                      )}
                    </div>
                    <div>
                      <div className="font-semibold">{lesson.title}</div>
                      <div className="text-sm text-muted-foreground flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {lesson.duration}
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      setCurrentLessonIndex(index);
                      setCurrentView('lesson');
                    }}
                    variant={completedLessons.has(lesson.id) ? "outline" : "default"}
                    size="sm"
                  >
                    {completedLessons.has(lesson.id) ? "Revoir" : "Commencer"}
                  </Button>
                </div>
              ))}
            </div>

            {/* Start Learning Button */}
            <div className="mt-6 text-center">
              <Button
                size="lg"
                onClick={() => setCurrentView('lesson')}
                className="w-full md:w-auto"
              >
                <Play className="w-5 h-5 mr-2" />
                Commencer le module
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Assessment Preview */}
        <Card className="border-0 shadow-lg bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-orange-800 dark:text-orange-200">
              <Award className="w-5 h-5" />
              <span>Évaluation finale</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-orange-700 dark:text-orange-300 mb-4">
              {moduleContent.finalAssessment.description}
            </p>
            <div className="flex items-center justify-between">
              <div className="text-sm text-orange-600 dark:text-orange-400">
                {moduleContent.finalAssessment.questions.length} questions • Score minimum: 80%
              </div>
              <Button
                variant="outline"
                onClick={() => setCurrentView('assessment')}
                disabled={completedLessons.size < moduleContent.lessons.length}
              >
                {completedLessons.size < moduleContent.lessons.length
                  ? "Terminez d'abord toutes les leçons"
                  : "Passer l'évaluation"
                }
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Exit Button */}
        <div className="text-center">
          <Button variant="outline" onClick={onExit}>
            Retour aux modules
          </Button>
        </div>
      </div>
    );
  }

  // Lesson View
  if (currentView === 'lesson') {
    const currentLesson = moduleContent.lessons[currentLessonIndex];
    return (
      <LessonViewer
        lesson={currentLesson}
        onComplete={handleLessonComplete}
        onNext={handleNextLesson}
        onPrevious={handlePreviousLesson}
        isFirst={currentLessonIndex === 0}
        isLast={currentLessonIndex === moduleContent.lessons.length - 1}
      />
    );
  }

  // Assessment View
  if (currentView === 'assessment') {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="border-0 shadow-lg bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-orange-800 dark:text-orange-200">
              <Award className="w-6 h-6" />
              <span>{moduleContent.finalAssessment.title}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-orange-700 dark:text-orange-300">
              {moduleContent.finalAssessment.description}
            </p>
            <div className="mt-4 text-sm text-orange-600 dark:text-orange-400">
              Score minimum requis: 80% • {moduleContent.finalAssessment.questions.length} questions
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="space-y-8">
              {moduleContent.finalAssessment.questions.map((question, questionIndex) => (
                <div key={questionIndex} className="space-y-4">
                  <div className="font-semibold text-lg">
                    Question {questionIndex + 1}: {question.question}
                  </div>
                  
                  <div className="space-y-2">
                    {question.answers.map((answer, answerIndex) => (
                      <label
                        key={answerIndex}
                        className="flex items-center space-x-3 cursor-pointer p-3 rounded-lg hover:bg-muted transition-colors"
                      >
                        <input
                          type="radio"
                          name={`question-${questionIndex}`}
                          value={answerIndex}
                          onChange={() => handleAssessmentAnswer(questionIndex, answerIndex)}
                          className="form-radio text-primary"
                        />
                        <span>{answer}</span>
                      </label>
                    ))}
                  </div>

                  {showResults && (
                    <div className={`p-4 rounded-lg ${
                      assessmentAnswers[questionIndex] === question.correct
                        ? 'bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800'
                        : 'bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800'
                    }`}>
                      <div className="font-semibold mb-2">
                        {assessmentAnswers[questionIndex] === question.correct ? '✅ Correct' : '❌ Incorrect'}
                      </div>
                      <p className="text-sm">{question.explanation}</p>
                      {assessmentAnswers[questionIndex] !== question.correct && (
                        <p className="text-sm mt-1">
                          <strong>Bonne réponse:</strong> {question.answers[question.correct]}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {!showResults && (
              <div className="mt-8 text-center">
                <Button
                  onClick={handleAssessmentSubmit}
                  size="lg"
                  disabled={Object.keys(assessmentAnswers).length < moduleContent.finalAssessment.questions.length}
                >
                  <Award className="w-5 h-5 mr-2" />
                  Soumettre l'évaluation
                </Button>
              </div>
            )}

            {showResults && (
              <div className="mt-8 text-center space-y-4">
                <div className="text-2xl font-bold">
                  Score: {Math.round((Object.values(assessmentAnswers).filter(
                    (answer, index) => answer === moduleContent.finalAssessment.questions[index].correct
                  ).length / moduleContent.finalAssessment.questions.length) * 100)}%
                </div>
                <div className="space-x-4">
                  <Button variant="outline" onClick={() => setCurrentView('overview')}>
                    Retour au module
                  </Button>
                  <Button onClick={onExit}>
                    Retour aux modules
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}