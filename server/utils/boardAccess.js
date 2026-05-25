const pool = require('../db');

async function getBoardAccess(
    boardId,
    userId,
    shareToken
){

    if (userId) {

        const owner = await pool.query(
            `SELECT *
             FROM boards
             WHERE id=$1
             AND user_id=$2`,
            [boardId, userId]
        );

        if (owner.rows.length > 0) {

            return {
                access: true,
                role: 'owner',
                mode: 'edit'
            };
        }
    }

    if (shareToken) {

        const share = await pool.query(
            `SELECT *
             FROM board_shares
             WHERE board_id=$1
             AND token=$2`,
            [boardId, shareToken]
        );

        if (share.rows.length > 0) {

            return {
                access: true,
                role: 'shared',
                mode: share.rows[0].mode
            };
        }
    }

    return {
        access: false
    };
}

module.exports = {
    getBoardAccess
};