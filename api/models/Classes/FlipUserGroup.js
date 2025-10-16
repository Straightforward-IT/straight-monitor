class FlipUserGroup {
    constructor(data) {
        this.group_id = data.id || null;
        this.external_id = data.external_id || null;
        this.title = data.title?.map(t => ({
            language: t.language || null,
            text: t.text || null
        })) || [];

        this.status = data.status || "ACTIVE";
        this.type = data.type || "CUSTOM";
        
        this.path = data.path?.map(p => ({
            id: p.id || null,
            title: {
                language: p.title?.language || null,
                text: p.title?.text || null
            },
            status: p.status || null
        })) || [];

        this.description = data.description?.map(d => ({
            language: d.language || null,
            text: d.text || null
        })) || [];

        this.parent_id = data.parent_id || null;
        this.number_of_contained_users = data.number_of_contained_users || 0;
        this.created_at = data.created_at || null;
        this.updated_at = data.updated_at || null;

        this.actions = {
            archive: data.actions?.archive?.allowed || false,
            assign_member: data.actions?.assign_member?.allowed || false,
            delete: data.actions?.delete?.allowed || false,
            edit: data.actions?.edit?.allowed || false,
            create_subgroup: data.actions?.create_subgroup?.allowed || false,
            manage_channels: data.actions?.manage_channels?.allowed || false,
            restore: data.actions?.restore?.allowed || false,
            manage_branding: data.actions?.manage_branding?.allowed || false
        };
    }

    /**
     * Converts FlipUserGroup object to a simplified format.
     */
    toSimplifiedObject() {
        return {
            group_id: this.group_id,
            title: this.title.map(t => t.text).join(", "),
            status: this.status,
            type: this.type,
            number_of_users: this.number_of_contained_users
        };
    }
}

module.exports = FlipUserGroup;
