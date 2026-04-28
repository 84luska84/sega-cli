/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { StatsDisplay } from './StatsDisplay.js';
import { useSessionStats } from '../contexts/SessionContext.js';
import { useConfig } from '../contexts/ConfigContext.js';
import { escapeShellArg, getShellConfiguration } from '@google/gemini-cli-core';

interface SessionSummaryDisplayProps {
  duration: string;
}

export const SessionSummaryDisplay: React.FC<SessionSummaryDisplayProps> = ({
  duration,
}) => {
  const { stats } = useSessionStats();
  const config = useConfig();
  const { shell } = getShellConfiguration();

  const worktreeSettings = config.getWorktreeSettings();

  const escapedSessionId = escapeShellArg(stats.sessionId, shell);
  let footer = `Para retomar esta sessão: sega --resume ${escapedSessionId}`;

  if (worktreeSettings) {
    footer =
      `Para retomar o trabalho neste worktree: cd ${escapeShellArg(worktreeSettings.path, shell)} && sega --resume ${escapedSessionId}\n` +
      `Para remover manualmente: git worktree remove ${escapeShellArg(worktreeSettings.path, shell)}`;
  }

  return (
    <StatsDisplay
      title="Desligando o agente. Até logo!"
      duration={duration}
      footer={footer}
    />
  );
};

