package main

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/multica-ai/multica/server/internal/events"
	"github.com/multica-ai/multica/server/internal/handler"
	"github.com/multica-ai/multica/server/internal/service"
	"github.com/multica-ai/multica/server/pkg/protocol"
)

// registerChannelListeners wires up event bus listeners that send status
// change notifications to assigned channels (e.g. Slack) so users are
// kept informed of agent progress.
func registerChannelListeners(bus *events.Bus, channelSvc *service.ChannelService) {
	// issue:updated — notify channel on status changes
	bus.Subscribe(protocol.EventIssueUpdated, func(e events.Event) {
		payload, ok := e.Payload.(map[string]any)
		if !ok {
			return
		}

		statusChanged, _ := payload["status_changed"].(bool)
		if !statusChanged {
			return
		}

		issue, ok := payload["issue"].(handler.IssueResponse)
		if !ok {
			return
		}

		prevStatus, _ := payload["prev_status"].(string)

		message := formatStatusMessage(issue.Title, prevStatus, issue.Status)

		// Send asynchronously to avoid blocking event dispatch.
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
			defer cancel()

			if err := channelSvc.SendNotification(ctx, issue.ID, message); err != nil {
				slog.Warn("channel notification: failed to send status update",
					"issue_id", issue.ID, "error", err)
			}
		}()
	})

	// task:completed — notify channel
	bus.Subscribe(protocol.EventTaskCompleted, func(e events.Event) {
		payload, ok := e.Payload.(map[string]any)
		if !ok {
			return
		}
		issueID, _ := payload["issue_id"].(string)
		if issueID == "" {
			return
		}

		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
			defer cancel()

			if err := channelSvc.SendNotification(ctx, issueID, "작업이 완료되었습니다."); err != nil {
				slog.Warn("channel notification: failed to send task completed",
					"issue_id", issueID, "error", err)
			}
		}()
	})

	// task:failed — notify channel
	bus.Subscribe(protocol.EventTaskFailed, func(e events.Event) {
		payload, ok := e.Payload.(map[string]any)
		if !ok {
			return
		}
		issueID, _ := payload["issue_id"].(string)
		if issueID == "" {
			return
		}
		errorMsg, _ := payload["error"].(string)

		message := "작업 실행 중 오류가 발생했습니다."
		if errorMsg != "" {
			message = fmt.Sprintf("작업 실행 중 오류가 발생했습니다: %s", errorMsg)
		}

		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
			defer cancel()

			if err := channelSvc.SendNotification(ctx, issueID, message); err != nil {
				slog.Warn("channel notification: failed to send task failed",
					"issue_id", issueID, "error", err)
			}
		}()
	})
}

func formatStatusMessage(title, from, to string) string {
	return fmt.Sprintf("📋 *%s*\n상태 변경: %s → %s",
		title, statusLabel(from), statusLabel(to))
}
