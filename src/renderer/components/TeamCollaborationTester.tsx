import React, { useState } from 'react';
import { Socket } from 'socket.io-client';
import { Agent, Message } from '../../shared/types';
import { Database, Users, CheckCircle, Clock, Play } from 'lucide-react';
import { theme } from '../utils/theme';

interface TestScenario {
  id: string;
  name: string;
  description: string;
  userMessage: string;
  expectedFlow: string[];
  criteria: Record<string, string>;
}

interface TestResult {
  status: string;
  score: number;
  timestamp: string;
  flow: any[];
  responses?: Message[];
}

interface TeamStatus {
  coordinator: 'ready' | 'working' | 'waiting';
  designer: 'ready' | 'working' | 'waiting';
  frontend: 'ready' | 'working' | 'waiting';
  backend: 'ready' | 'working' | 'waiting';
}

export interface TeamCollaborationTesterProps {
  activeConversationId: string | null;
  agents: Agent[];
  apiService: any;
  socketRef: React.RefObject<Socket | null>;
}

const TeamCollaborationTester: React.FC<TeamCollaborationTesterProps> = ({ activeConversationId, agents, apiService, socketRef }) => {
  const [activeTest, setActiveTest] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [teamStatus, setTeamStatus] = useState<TeamStatus>({
    coordinator: 'ready',
    designer: 'ready',
    frontend: 'ready',
    backend: 'ready'
  });
  const [sharedMemory] = useState({
    project: {
      name: 'Web Development Project',
      status: 'planning',
      requirements: {},
      timeline: {}
    },
    currentTask: null as any,
    lastUpdate: new Date().toISOString()
  });

  const testScenarios: TestScenario[] = [
    {
      id: 'project-kickoff',
      name: '🚀 Project Kickoff',
      description: 'Test how the team handles initial project requirements',
      userMessage: 'I need to build a user dashboard for a SaaS application. It should have user authentication, data visualization charts, and a settings page. Users should be able to view their account stats, change their profile information, and see usage analytics.',
      expectedFlow: [
        'Coordinator analyzes requirements',
        'Coordinator delegates tasks to team members',
        'Designer creates wireframes and user flows',
        'Backend designs database and API structure',
        'Frontend plans component architecture'
      ],
      criteria: {
        coordination: 'Coordinator breaks down tasks clearly',
        design: 'Designer creates comprehensive wireframes',
        backend: 'Backend designs proper API structure',
        frontend: 'Frontend plans component hierarchy',
        collaboration: 'Team members communicate effectively'
      }
    },
    {
      id: 'feature-request',
      name: '⚡ Feature Addition',
      description: 'Test how team handles new feature requests',
      userMessage: 'Add a real-time notification system to the dashboard. Users should see notifications for important events and be able to mark them as read.',
      expectedFlow: [
        'Coordinator assesses impact on existing work',
        'Backend designs notification data model',
        'Designer creates notification UI components',
        'Frontend implements real-time updates',
        'Team coordinates integration points'
      ],
      criteria: {
        coordination: 'Proper impact assessment and planning',
        design: 'UI design for notifications',
        backend: 'Real-time architecture planning',
        frontend: 'Real-time state management',
        collaboration: 'Dependency management'
      }
    },
    {
      id: 'technical-challenge',
      name: '🔧 Technical Problem',
      description: 'Test problem-solving and technical discussion',
      userMessage: 'The dashboard is loading slowly, especially the charts. Users are complaining about performance. How can we optimize this?',
      expectedFlow: [
        'Coordinator identifies stakeholders',
        'Frontend analyzes performance bottlenecks',
        'Backend reviews API performance',
        'Designer considers UX improvements',
        'Team proposes optimization strategy'
      ],
      criteria: {
        coordination: 'Organizes technical investigation',
        design: 'UX considerations for loading states',
        backend: 'API and database optimization',
        frontend: 'Frontend performance optimization',
        collaboration: 'Holistic solution approach'
      }
    },
    {
      id: 'design-iteration',
      name: '🎨 Design Feedback',
      description: 'Test design collaboration and iteration',
      userMessage: '@designer The login page design looks good, but can we make it more mobile-friendly? Also, the color scheme needs to match our brand colors (blue: #2563eb, gray: #6b7280).',
      expectedFlow: [
        'Designer acknowledges feedback',
        'Designer proposes mobile-first redesign',
        'Frontend reviews implementation complexity',
        'Coordinator tracks design iteration timeline',
        'Team updates shared design system'
      ],
      criteria: {
        coordination: 'Tracks design changes impact',
        design: 'Responsive design iteration',
        backend: 'No backend impact needed',
        frontend: 'Implementation feasibility review',
        collaboration: 'Design system consistency'
      }
    },
    {
      id: 'integration-discussion',
      name: '🔗 Integration Planning',
      description: 'Test cross-team technical coordination',
      userMessage: '@frontend @backend How should we handle user authentication state across page refreshes? Do we store JWT in localStorage or use httpOnly cookies?',
      expectedFlow: [
        'Backend explains security implications',
        'Frontend discusses state management needs',
        'Coordinator facilitates technical decision',
        'Team agrees on implementation approach',
        'Shared memory updated with decision'
      ],
      criteria: {
        coordination: 'Facilitates technical decisions',
        design: 'UX implications considered',
        backend: 'Security best practices',
        frontend: 'State management strategy',
        collaboration: 'Consensus building'
      }
    }
  ];

  const runTest = async (scenario: TestScenario) => {
    setActiveTest(scenario.id);
    setTeamStatus({ coordinator: 'working', designer: 'working', frontend: 'working', backend: 'working' });

    const testFlow: any[] = [];
    let responseCount = 0;
    const startTime = Date.now();

    try {
      if (activeConversationId && socketRef.current) {
        socketRef.current.emit('message', {
          conversationId: activeConversationId,
          senderId: 'user',
          content: scenario.userMessage,
          type: 'user'
        });

        testFlow.push({ timestamp: Date.now(), actor: 'user', action: 'message', content: scenario.userMessage });

        const checkResponses = () => {
          apiService.fetchMessages(activeConversationId).then((messages: Message[]) => {
            const recentMessages = messages.filter((m: Message) =>
              m.timestamp > new Date(startTime).toISOString() && m.senderId !== 'user'
            );

            responseCount = recentMessages.length;

            recentMessages.forEach((msg: Message) => {
              const agent = agents.find((a: Agent) => a.id === msg.senderId);
              testFlow.push({
                timestamp: Date.now(),
                actor: agent?.role || msg.senderId,
                action: 'response',
                content: msg.content.substring(0, 100) + '...',
                fullContent: msg.content
              });
            });

            if (responseCount >= 3 || Date.now() - startTime > 30000) {
              const score = calculateTestScore(scenario, testFlow, responseCount);
              setTeamStatus({ coordinator: 'ready', designer: 'ready', backend: 'ready', frontend: 'ready' });
              setTestResults(prev => ({
                ...prev,
                [scenario.id]: {
                  status: 'completed',
                  score,
                  timestamp: new Date().toISOString(),
                  flow: testFlow,
                  responses: recentMessages
                }
              }));
              setActiveTest(null);
            } else {
              setTimeout(checkResponses, 2000);
            }
          });
        };

        setTimeout(checkResponses, 3000);
      } else {
        throw new Error('No active conversation found. Please create a team conversation first.');
      }
    } catch (error) {
      console.error('Test failed:', error);
      setTeamStatus({ coordinator: 'ready', designer: 'ready', backend: 'ready', frontend: 'ready' });
      setActiveTest(null);
    }
  };

  const calculateTestScore = (_scenario: TestScenario, flow: any[], responseCount: number): number => {
    let score = 60;
    const coordinatorResponse = flow.find(f => f.actor === 'coordinator');
    if (coordinatorResponse) score += 10;
    const uniqueResponders = new Set(flow.filter(f => f.actor !== 'user').map(f => f.actor));
    score += Math.min(uniqueResponders.size * 5, 15);
    score += Math.min(responseCount * 3, 15);
    return Math.min(score, 100);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready': return <CheckCircle size={16} />;
      case 'working': return <Clock size={16} className="animate-spin" />;
      default: return <Clock size={16} />;
    }
  };

  return (
    <div style={{ color: theme.colors.text, maxWidth: '100%' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
          Web Development Team Collaboration Tester
        </h1>
        <p style={{ color: theme.colors.textMuted }}>
          Test how well your Ollama-powered web development team works together on real scenarios.
        </p>
      </div>

      <div style={{ marginBottom: '32px', padding: '24px', background: theme.colors.backgroundSecondary, borderRadius: '8px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center' }}>
          <Users size={20} style={{ marginRight: '8px' }} />
          Team Status
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          {Object.entries(teamStatus).map(([role, status]) => (
            <div key={role} style={{
              padding: '12px',
              borderRadius: '8px',
              border: `1px solid ${theme.colors.border}`,
              background: status === 'ready' ? 'rgba(59, 165, 93, 0.1)' : 
                         status === 'working' ? 'rgba(250, 166, 26, 0.1)' : 
                         'rgba(150, 152, 157, 0.1)',
              color: status === 'ready' ? '#3ba55d' : 
                     status === 'working' ? '#faa61a' : 
                     theme.colors.textMuted
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: '500', textTransform: 'capitalize' }}>{role}</span>
                {getStatusIcon(status)}
              </div>
              <div style={{ fontSize: '14px', marginTop: '4px', textTransform: 'capitalize' }}>{status}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '32px', padding: '24px', background: 'rgba(88, 101, 242, 0.1)', borderRadius: '8px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center' }}>
          <Database size={20} style={{ marginRight: '8px' }} />
          Shared Workspace Memory
        </h2>
        <div style={{ background: theme.colors.backgroundTertiary, padding: '16px', borderRadius: '4px', border: `1px solid ${theme.colors.border}` }}>
          <pre style={{ fontSize: '14px', color: theme.colors.text, overflow: 'auto', margin: 0 }}>
            {JSON.stringify(sharedMemory, null, 2)}
          </pre>
        </div>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>Test Scenarios</h2>
        <div style={{ display: 'grid', gap: '24px' }}>
          {testScenarios.map((scenario) => (
            <div key={scenario.id} style={{
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '8px',
              padding: '24px',
              background: theme.colors.backgroundSecondary
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
                    {scenario.name}
                  </h3>
                  <p style={{ color: theme.colors.textMuted, marginBottom: '16px' }}>{scenario.description}</p>

                  <div style={{ marginBottom: '16px' }}>
                    <h4 style={{ fontWeight: '500', marginBottom: '8px' }}>User Message:</h4>
                    <div style={{ background: theme.colors.backgroundTertiary, padding: '12px', borderRadius: '4px', fontSize: '14px' }}>
                      {scenario.userMessage}
                    </div>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <h4 style={{ fontWeight: '500', marginBottom: '8px' }}>Expected Flow:</h4>
                    <ul style={{ fontSize: '14px', color: theme.colors.textMuted, margin: 0, paddingLeft: '20px' }}>
                      {scenario.expectedFlow.map((step, index) => (
                        <li key={index} style={{ marginBottom: '4px' }}>
                          <span style={{
                            display: 'inline-block',
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            background: 'rgba(88, 101, 242, 0.2)',
                            color: theme.colors.primary,
                            fontSize: '12px',
                            textAlign: 'center',
                            lineHeight: '20px',
                            marginRight: '8px'
                          }}>
                            {index + 1}
                          </span>
                          {step}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div style={{ marginLeft: '16px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <button
                    onClick={() => runTest(scenario)}
                    disabled={activeTest === scenario.id}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      border: 'none',
                      cursor: activeTest === scenario.id ? 'not-allowed' : 'pointer',
                      background: activeTest === scenario.id ? theme.colors.backgroundTertiary : theme.colors.primary,
                      color: activeTest === scenario.id ? theme.colors.textMuted : theme.colors.textBright,
                      opacity: activeTest === scenario.id ? 0.5 : 1
                    }}
                  >
                    <Play size={16} />
                    <span>{activeTest === scenario.id ? 'Running...' : 'Run Test'}</span>
                  </button>

                  {testResults[scenario.id] && (
                    <div style={{ marginTop: '12px', textAlign: 'right' }}>
                      <div style={{ fontSize: '14px', color: theme.colors.textMuted }}>Last Run</div>
                      <div style={{
                        fontSize: '18px',
                        fontWeight: 'bold',
                        color: testResults[scenario.id].score >= 90 ? '#3ba55d' : 
                               testResults[scenario.id].score >= 80 ? '#faa61a' : '#ed4245'
                      }}>
                        {testResults[scenario.id].score}%
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', fontSize: '14px' }}>
                <div>
                  <h4 style={{ fontWeight: '500', marginBottom: '8px' }}>Success Criteria:</h4>
                  <ul style={{ color: theme.colors.textMuted, margin: 0, paddingLeft: '20px' }}>
                    {Object.entries(scenario.criteria).map(([role, criterion]) => (
                      <li key={role} style={{ marginBottom: '4px' }}>
                        <span style={{ width: '80px', display: 'inline-block', textTransform: 'capitalize', fontWeight: '500' }}>{role}:</span>
                        <span>{criterion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {Object.keys(testResults).length > 0 && (
        <div style={{ padding: '24px', background: 'rgba(59, 165, 93, 0.1)', borderRadius: '8px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px', color: '#3ba55d' }}>Test Results Summary</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div style={{ background: theme.colors.backgroundSecondary, padding: '16px', borderRadius: '4px', border: `1px solid ${theme.colors.border}` }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3ba55d' }}>
                {Object.keys(testResults).length}
              </div>
              <div style={{ fontSize: '14px', color: theme.colors.textMuted }}>Tests Completed</div>
            </div>
            <div style={{ background: theme.colors.backgroundSecondary, padding: '16px', borderRadius: '4px', border: `1px solid ${theme.colors.border}` }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: theme.colors.primary }}>
                {Math.round(Object.values(testResults).reduce((acc, result) => acc + result.score, 0) / Object.keys(testResults).length || 0)}%
              </div>
              <div style={{ fontSize: '14px', color: theme.colors.textMuted }}>Average Score</div>
            </div>
            <div style={{ background: theme.colors.backgroundSecondary, padding: '16px', borderRadius: '4px', border: `1px solid ${theme.colors.border}` }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#a855f7' }}>
                {Object.values(testResults).filter(result => result.score >= 90).length}
              </div>
              <div style={{ fontSize: '14px', color: theme.colors.textMuted }}>Excellent Results</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamCollaborationTester;


