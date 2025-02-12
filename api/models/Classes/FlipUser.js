const { flipAxios } = require("../../flipAxios");

class FlipUser {
  constructor(data) {
    this.id = data.id || null;
    this.external_id = data.external_id || null;
    this.vorname = data.first_name || null;
    this.nachname = data.last_name || null;
    this.email = data.email || null;
    this.status = data.status || "ACTIVE";
    this.benutzername = data.username || null;
    this.erstellungsdatum = data.created_at || null;
    this.aktualisierungsdatum = data.updated_at || null;
    this.loeschdatum = data.deletion_at || null;

    this.profilbild = data.profile_picture?.file_id || null;
    this.rolle = data.role || "USER";
    this.required_actions = data.required_actions || [];
    this.profile = data.profile || null;
    this.primary_user_group = {
      id: data.primary_user_group?.id || null,
      title: data.primary_user_group?.title?.text || null,
      language: data.primary_user_group?.title?.language || null,
      status: data.primary_user_group?.status || null,
    };
  }

  /**
   * Updates this FlipUser via the Flip API.
   */
  async update() {
    try {
      if (!this.id) {
        throw new Error("FlipUser must have a valid id to be updated.");
      }

      const response = await flipAxios.patch(
        `/api/admin/users/v4/users/${this.id}`,
        {
          external_id: this.external_id,
          first_name: this.vorname,
          last_name: this.nachname,
          email: this.email,
          username: this.benutzername,
          role: this.rolle,
          primary_user_group_id: this.primary_user_group?.id || null,
        },
        { headers: { "content-type": "application/merge-patch+json" } }
      );

      console.log(`✅ Updated FlipUser (${this.vorname} ${this.nachname}):`, response.data);
      return response.data;
    } catch (error) {
      console.error(`❌ Failed to update FlipUser (${this.id}):`, error.response?.data || error.message);
      throw error;
    }
  }
  async setDefaultPassword() {
    try{
        const response = await flipAxios.post(`/api/admin/users/v4/users/${this.id}/password`, {
            password: 'password',
            temporary: true
        }, {
            headers: { "Content-Type": "application/json" }
        });
        console.log("Changed password");
        return response.data;
    } catch(error) {
        console.error(`❌ Failed to update Password for  FlipUser (${this.id}):`, error.response?.data || error.message);
    }
  }

  setExternalId(external_id) {
    this.external_id = external_id;
  }
  
    async create() {
        try {
            if (!this.vorname || !this.nachname || !this.email) {
                throw new Error("Missing required fields: first_name, last_name, or email.");
            }
    
            const payload = {
                external_id: this.external_id,
                first_name: this.vorname,
                last_name: this.nachname,
                email: this.email,
                status: this.status,
                username: this.benutzername || this.email,
                role: this.rolle,
                profile: this.profile,
                required_actions: ["ACCEPT_TERMS_AND_CONDITIONS"],
                primary_user_group_id: this.primary_user_group?.id || null
            };
    
            const response = await flipAxios.post("/api/admin/users/v4/users", payload, {
                headers: { "Content-Type": "application/json" }
            });
    
            console.log(`✅ FlipUser created: ${this.vorname} ${this.nachname}`, response.data);
            return new FlipUser(response.data);
        } catch (error) {
            console.error(`❌ Error creating FlipUser:`, error.response?.data || error.message);
            throw new Error(error.response?.data || error.message);
        }
    }
  

  /**
   * Converts FlipUser object to a Mitarbeiter-compatible format.
   */
  toMitarbeiter() {
    return {
      flip_id: this.id,
      vorname: this.vorname,
      nachname: this.nachname,
      email: this.email,
      isActive: this.status === "ACTIVE",
      dateCreated: this.erstellungsdatum,
    };
  }
}

module.exports = FlipUser;