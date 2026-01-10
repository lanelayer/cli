/// Trait for handling webhook completion results deterministically
/// This replaces the channel-based approach to avoid non-determinism
pub trait WebhookCompletionHandler: Send + Sync {
    /// Called when a webhook submission succeeds
    fn on_webhook_success(&mut self);

    /// Called when a webhook submission fails
    fn on_webhook_failure(&mut self);

    /// Check if the webhook submission has succeeded
    fn has_succeeded(&self) -> bool;

    /// Check if the webhook submission has failed
    fn has_failed(&self) -> bool;

    /// Reset the handler's state
    fn reset(&mut self);
}
