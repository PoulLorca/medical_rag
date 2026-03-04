export function useModels() {
  const models = [    
    { label: 'Minimax M2.5', value: 'minimax/minimax-m2.5', icon: 'i-simple-icons-minimax' },
    { label: 'GPT-5.2', value: 'openai/gpt-5.2', icon: 'i-simple-icons-openai' },
    { label: 'Claude Sonnet 4.6', value: 'anthropic/claude-sonnet-4.6', icon: 'i-simple-icons-anthropic' },            
    { label: 'Gemini 3.1 Pro Preview', value: 'google/gemini-3.1-pro-preview', icon: 'i-simple-icons-google' },    
  ]

  const model = useCookie<string>('model', { default: () => 'minimax/minimax-m2.5' })

  return {
    models,
    model
  }
}
