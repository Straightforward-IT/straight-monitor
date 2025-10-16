const { flipAxios } = require("../../flipAxios");

class FlipTask {
  constructor(data) {
    this.id = data.id || null;
    this.external_id = data.external_id || null;
    this.correlation_id = data.correlation_id || null;
    this.author_id = data.author_id || null;
    this.title = data.title || null;
    this.recipients = data.recipients || null;

    this.body = {
      plain: data.body?.plain || null,
      delta: data.body?.delta || [],
      html: data.body?.html || null,
      language: data.body?.language || null,
    };

    this.settings = {
      comments_enabled: data.settings?.comments_enabled || false,
      comments_count: data.settings?.comments_count || 0,
    };

    this.due_at = data.due_at || null;

    this.progress_status = data.progress_status || "OPEN";
    this.distribution_kind = data.distribution_kind || "PERSONAL";

    this.created_at = data.created_at || null;
    this.updated_at = data.updated_at || null;

    this.assignment_summary = {
      total: data.assignment_summary?.total || 0,
      items:
        data.assignment_summary?.items?.map((item) => ({
          count: item.count || 0,
          status: item.status || "NEW",
        })) || [],
    };
  }

  async find() {
    try {
      const response = await flipAxios.get("/api/tasks/v4/tasks", {
        params: { external_id: this.external_id },
      });
      if (!this.external_id || this.external_id === "") {
        console.log("No external_id");
        return [];
      }

      if (!response.data || !Array.isArray(response.data.tasks)) {
        console.log("⚠️ No tasks found with external_id:", this.external_id);
        return [];
      }

      console.log(
        `🔎 Found ${response.data.tasks.length} tasks matching external_id.`
      );
      return response.data.tasks.map((task) => new FlipTask(task));
    } catch (error) {
      console.error(
        "❌ Error fetching Flip Tasks:",
        error.response ? error.response.data : error.message
      );
      throw new Error(
        error.response ? JSON.stringify(error.response.data) : error.message
      );
    }
  }
  /**
   * Creates a new Flip task using the API
   * @returns {Promise<FlipTask>}
   */
  async create() {
    try {
      if (!this.title) {
        throw new Error("Missing required fields: title or recipients");
      }

      const payload = {
        external_id: this.external_id || null,
        title: this.title,
        body: {
          content_format: "HTML",
          contentHtml: this.body.html,
        },
        settings: { comments_enabled: true },
        recipients: this.recipients,
      };

      if (this.due_at?.date && this.due_at?.type) {
        payload.due_at = {
          date: this.due_at.date,
          due_at_type: this.due_at.type,
        };
      }

      const response = await flipAxios.post("/api/tasks/v4/tasks", payload);

      //console.log("✅ Flip Task Created Successfully:", response.data);
      return new FlipTask(response.data);
    } catch (error) {
      console.error(
        "❌ Error creating Flip Task:",
        error.response ? error.response.data : error.message
      );
      throw new Error(
        error.response ? JSON.stringify(error.response.data) : error.message
      );
    }
  }
  async update() {
    try {
      if (!this.id) {
        throw new Error("Cannot update task: Missing id.");
      }

      const payload = {
        external_id: this.external_id,
        title: this.title,
        body: {
          content_format: "HTML",
          contentHtml: this.body.html,
        },
        settings: {
          comments_enabled: this.settings.comments_enabled,
        },
        recipients: this.recipients,
        progress_status: this.progress_status,
      };

      // ✅ Only include "due_at" if it has a valid "due_at_type"
      if (this.due_at?.type) {
        payload.due_at = {
          date: this.due_at.date,
          due_at_type: this.due_at.type, // ✅ Ensure correct property name
        };
      }

      console.log(
        `🔄 Updating Flip Task (${this.id}) with:`,
        JSON.stringify(payload, null, 2)
      );

      const response = await flipAxios.patch(
        `/api/tasks/v4/tasks/${this.id}`,
        payload,
        {
          headers: { "Content-Type": "application/merge-patch+json" },
        }
      );

      console.log("✅ Flip Task Updated Successfully:", response.data);
      return new FlipTask(response.data);
    } catch (error) {
      console.error(
        "❌ Error updating Flip Task:",
        error.response ? error.response.data : error.message
      );
      throw new Error(
        error.response ? JSON.stringify(error.response.data) : error.message
      );
    }
  }

  /**
   * Converts FlipTask object to a simplified format.
   */
  toSimplifiedObject() {
    return {
      id: this.id,
      title: this.title,
      progress_status: this.progress_status,
      distribution_kind: this.distribution_kind,
      due_date: this.due_at?.date,
      total_assignments: this.assignment_summary.total,
    };
  }
}

module.exports = FlipTask;
