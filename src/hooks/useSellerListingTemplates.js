import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import {
    fetchListingTemplates, createListingTemplate, updateListingTemplate, deleteListingTemplate,
} from "../utils/sellerListingApi.js";

// Manages the saved "groups" for a single groupable section (e.g.
// "delivery"). Used by GroupTemplateBar so every groupable section in
// SellerListingForm gets load / save / set-default for free.
export default function useSellerListingTemplates(groupType) {
    const { token } = useAuth();
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const reload = useCallback(() => {
        if (!token) { setLoading(false); return; }
        setLoading(true);
        fetchListingTemplates(token, groupType).then((res) => {
            setTemplates(res?.success ? res.items || [] : []);
            setLoading(false);
        });
    }, [token, groupType]);

    useEffect(() => { reload(); }, [reload]);

    const saveAsTemplate = useCallback(async (name, data, isDefault = false) => {
        setSaving(true);
        const res = await createListingTemplate(token, { groupType, name, data, isDefault });
        setSaving(false);
        if (res?.success) reload();
        return res;
    }, [token, groupType, reload]);

    const setDefault = useCallback(async (id) => {
        const res = await updateListingTemplate(token, id, { isDefault: true });
        if (res?.success) reload();
        return res;
    }, [token, reload]);

    const remove = useCallback(async (id) => {
        const res = await deleteListingTemplate(token, id);
        if (res?.success) reload();
        return res;
    }, [token, reload]);

    return { templates, loading, saving, saveAsTemplate, setDefault, remove, reload };
}