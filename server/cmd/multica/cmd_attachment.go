package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/spf13/cobra"

	"github.com/multica-ai/multica/server/internal/cli"
)

var attachmentCmd = &cobra.Command{
	Use:   "attachment",
	Short: "Manage attachments",
}

var attachmentUploadCmd = &cobra.Command{
	Use:   "upload <file-path> [additional-file-paths...]",
	Short: "Upload file(s) to an issue",
	Long:  "Uploads one or more files and attaches them to the specified issue. Returns attachment metadata as JSON.",
	Args:  cobra.MinimumNArgs(1),
	RunE:  runAttachmentUpload,
}

var attachmentDownloadCmd = &cobra.Command{
	Use:   "download <attachment-id>",
	Short: "Download an attachment to a local file",
	Long:  "Fetches the attachment metadata from the API, then downloads the file using its signed URL. Prints the local file path on success.",
	Args:  cobra.ExactArgs(1),
	RunE:  runAttachmentDownload,
}

func init() {
	attachmentCmd.AddCommand(attachmentUploadCmd)
	attachmentCmd.AddCommand(attachmentDownloadCmd)

	attachmentUploadCmd.Flags().String("issue", "", "Issue ID to attach the file(s) to (required)")
	attachmentUploadCmd.Flags().String("comment", "", "Comment content to create with the attachment(s)")
	attachmentUploadCmd.Flags().String("output", "json", "Output format: table or json")

	attachmentDownloadCmd.Flags().StringP("output-dir", "o", ".", "Directory to save the downloaded file")
}

func runAttachmentUpload(cmd *cobra.Command, args []string) error {
	issueID, _ := cmd.Flags().GetString("issue")
	if issueID == "" {
		return fmt.Errorf("--issue is required")
	}

	client, err := newAPIClient(cmd)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()

	var uploaded []map[string]any
	var attachmentIDs []string
	for _, filePath := range args {
		data, readErr := os.ReadFile(filePath)
		if readErr != nil {
			return fmt.Errorf("read file %s: %w", filePath, readErr)
		}
		id, uploadErr := client.UploadFile(ctx, data, filePath, issueID)
		if uploadErr != nil {
			return fmt.Errorf("upload file %s: %w", filePath, uploadErr)
		}
		attachmentIDs = append(attachmentIDs, id)
		uploaded = append(uploaded, map[string]any{
			"id":       id,
			"filename": filepath.Base(filePath),
		})
		fmt.Fprintf(os.Stderr, "Uploaded %s (id: %s)\n", filepath.Base(filePath), id)
	}

	// Optionally create a comment with the uploaded attachments.
	commentContent, _ := cmd.Flags().GetString("comment")
	if commentContent != "" {
		body := map[string]any{
			"content":        commentContent,
			"attachment_ids": attachmentIDs,
		}
		var commentResult map[string]any
		if err := client.PostJSON(ctx, "/api/issues/"+issueID+"/comments", body, &commentResult); err != nil {
			return fmt.Errorf("create comment: %w", err)
		}
		fmt.Fprintf(os.Stderr, "Comment added to issue %s.\n", issueID[:8])
	}

	output, _ := cmd.Flags().GetString("output")
	if output == "table" {
		headers := []string{"ID", "FILENAME"}
		rows := make([][]string, 0, len(uploaded))
		for _, u := range uploaded {
			rows = append(rows, []string{
				fmt.Sprintf("%v", u["id"]),
				fmt.Sprintf("%v", u["filename"]),
			})
		}
		cli.PrintTable(os.Stdout, headers, rows)
		return nil
	}

	return cli.PrintJSON(os.Stdout, uploaded)
}

func runAttachmentDownload(cmd *cobra.Command, args []string) error {
	client, err := newAPIClient(cmd)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	// Fetch attachment metadata (includes signed download_url).
	var att map[string]any
	if err := client.GetJSON(ctx, "/api/attachments/"+args[0], &att); err != nil {
		return fmt.Errorf("get attachment: %w", err)
	}

	downloadURL := strVal(att, "download_url")
	if downloadURL == "" {
		return fmt.Errorf("attachment has no download URL")
	}

	filename := filepath.Base(strVal(att, "filename"))
	if filename == "" || filename == "." {
		filename = args[0]
	}

	// Download the file content.
	data, err := client.DownloadFile(ctx, downloadURL)
	if err != nil {
		return fmt.Errorf("download file: %w", err)
	}

	// Write to the output directory.
	outputDir, _ := cmd.Flags().GetString("output-dir")
	destPath := filepath.Join(outputDir, filename)

	if err := os.WriteFile(destPath, data, 0o644); err != nil {
		return fmt.Errorf("write file: %w", err)
	}

	// Print the absolute path so agents can reference the file.
	abs, err := filepath.Abs(destPath)
	if err != nil {
		abs = destPath
	}
	fmt.Fprintln(os.Stderr, "Downloaded:", abs)

	// Also print as JSON for --output json compatibility.
	return cli.PrintJSON(os.Stdout, map[string]any{
		"id":       strVal(att, "id"),
		"filename": filename,
		"path":     abs,
		"size":     strVal(att, "size_bytes"),
	})
}
