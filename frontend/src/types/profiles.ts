export type UserProfile =
  | 'business_analyst'
  | 'student'
  | 'data_scientist'
  | 'operations_manager'
  | 'general'

export interface ProfileConfig {
  id: UserProfile
  name: string
  description: string
  icon: string
  features: {
    showKPIs: boolean
    showDataQuality: boolean
    showColumnProfiling: boolean
    showDashboard: boolean
    showAdvancedOperations: boolean
    showBatchProcessing: boolean
    showMergeFiles: boolean
    showAutoAnalysis: boolean
    showTrendCharts: boolean
    showExportToPDF: boolean
    maxFileSize: number // in MB
    recommendedOperations: string[]
  }
  tips: string[]
  sampleUseCase: string
}

export const PROFILE_CONFIGS: Record<UserProfile, ProfileConfig> = {
  business_analyst: {
    id: 'business_analyst',
    name: 'Business Analyst',
    description: 'For professionals analyzing business data, KPIs, and reports',
    icon: '📊',
    features: {
      showKPIs: true,
      showDataQuality: true,
      showColumnProfiling: true,
      showDashboard: true,
      showAdvancedOperations: true,
      showBatchProcessing: true,
      showMergeFiles: true,
      showAutoAnalysis: true,
      showTrendCharts: true,
      showExportToPDF: true,
      maxFileSize: 50,
      recommendedOperations: ['aggregate', 'gross_profit', 'net_profit', 'filter', 'sort'],
    },
    tips: [
      'Use KPI cards to quickly see sum, average, and trends',
      'Save pipelines for monthly reporting workflows',
      'Check data quality score before presenting to stakeholders',
    ],
    sampleUseCase: 'Monthly sales analysis, revenue reporting, performance dashboards',
  },

  student: {
    id: 'student',
    name: 'Student / Learner',
    description: 'For students working on assignments and learning data analysis',
    icon: '🎓',
    features: {
      showKPIs: false,
      showDataQuality: true,
      showColumnProfiling: true,
      showDashboard: false,
      showAdvancedOperations: false,
      showBatchProcessing: false,
      showMergeFiles: true,
      showAutoAnalysis: false,
      showTrendCharts: false,
      showExportToPDF: false,
      maxFileSize: 10,
      recommendedOperations: ['filter', 'sort', 'math', 'remove_duplicates', 'text_cleanup'],
    },
    tips: [
      'Start with simple operations like Filter and Sort',
      'Use Column Profiling to understand your data distribution',
      'Save your pipeline to reuse for similar assignments',
    ],
    sampleUseCase: 'Homework data analysis, project work, learning Excel alternatives',
  },

  data_scientist: {
    id: 'data_scientist',
    name: 'Data Scientist',
    description: 'For advanced users needing custom formulas and complex transformations',
    icon: '🔬',
    features: {
      showKPIs: true,
      showDataQuality: true,
      showColumnProfiling: true,
      showDashboard: true,
      showAdvancedOperations: true,
      showBatchProcessing: true,
      showMergeFiles: true,
      showAutoAnalysis: true,
      showTrendCharts: true,
      showExportToPDF: true,
      maxFileSize: 100,
      recommendedOperations: ['custom_formula', 'aggregate', 'convert_to_numeric', 'date_format', 'split_column'],
    },
    tips: [
      'Use Custom Formula for complex calculations',
      'Batch process multiple datasets efficiently',
      'Export pipelines as reusable templates',
    ],
    sampleUseCase: 'Feature engineering, data preprocessing, ETL workflows',
  },

  operations_manager: {
    id: 'operations_manager',
    name: 'Operations Manager',
    description: 'For managing team workflows and batch processing',
    icon: '⚙️',
    features: {
      showKPIs: true,
      showDataQuality: true,
      showColumnProfiling: false,
      showDashboard: true,
      showAdvancedOperations: false,
      showBatchProcessing: true,
      showMergeFiles: true,
      showAutoAnalysis: true,
      showTrendCharts: true,
      showExportToPDF: true,
      maxFileSize: 50,
      recommendedOperations: ['filter', 'merge_columns', 'replace', 'sort', 'select_columns'],
    },
    tips: [
      'Use Batch Processing for monthly regional reports',
      'Save pipelines to share with your team',
      'Schedule regular transformations for consistency',
    ],
    sampleUseCase: 'Regional data consolidation, team reporting, inventory management',
  },

  general: {
    id: 'general',
    name: 'General User',
    description: 'Basic transformations and data cleanup',
    icon: '👤',
    features: {
      showKPIs: true,
      showDataQuality: true,
      showColumnProfiling: true,
      showDashboard: false,
      showAdvancedOperations: false,
      showBatchProcessing: false,
      showMergeFiles: true,
      showAutoAnalysis: false,
      showTrendCharts: false,
      showExportToPDF: false,
      maxFileSize: 25,
      recommendedOperations: ['filter', 'sort', 'remove_duplicates', 'text_cleanup', 'math'],
    },
    tips: [
      'Start with Filter to focus on relevant data',
      'Use Sort to organize your results',
      'Remove Duplicates to clean your data',
    ],
    sampleUseCase: 'Basic data cleanup, simple transformations, personal projects',
  },
}

