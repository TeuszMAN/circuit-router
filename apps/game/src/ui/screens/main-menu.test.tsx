import { afterEach, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/preact'
import { MainMenu } from './main-menu'
import { createAppState, createMemoryStorage } from '../state'
import { createCampaign } from '../../app/content'

afterEach(cleanup)

it('permite experimentar o inversor sem alterar a campanha e mantém Jogar acessível', () => {
  const state = createAppState(createMemoryStorage())
  const campaign = createCampaign()
  render(<MainMenu state={state} levels={campaign.summaries} />)
  expect(screen.getByText(/O NOT transforma 1 em 0/)).toBeTruthy()
  fireEvent.click(
    screen.getByRole('button', { name: 'Alternar sinal de entrada' }),
  )
  expect(screen.getByText(/O NOT transforma 0 em 1/)).toBeTruthy()
  expect(
    campaign.summaries.every((level) => !state.progressFor(level.id)),
  ).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Jogar' }))
  expect(state.route.value).toEqual({ name: 'levels' })
})
