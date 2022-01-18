import {
  Alert,
  Button,
  Dialog,
  Intent,
  Popover,
  Spinner,
} from "@blueprintjs/core";
import format from "date-fns/format";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import getParentUidByBlockUid from 'roamjs-components/queries/getParentUidByBlockUid';
import getBasicTreeByParentUid from 'roamjs-components/queries/getBasicTreeByParentUid';
import openBlockInSidebar from 'roamjs-components/writes/openBlockInSidebar';
import resolveRefs from 'roamjs-components/dom/resolveRefs';
import getTextByBlockUid from 'roamjs-components/queries/getTextByBlockUid';
import {
  TreeNode,
} from "roamjs-components/types";
import apiDelete from "roamjs-components/util/apiDelete"; 
import apiGet from "roamjs-components/util/apiGet"; 
import apiPut from "roamjs-components/util/apiPut"; 
import startOfMinute from "date-fns/startOfMinute";
import addMinutes from "date-fns/addMinutes";
import endOfYear from "date-fns/endOfYear";
import addYears from "date-fns/addYears";
import { DatePicker } from "@blueprintjs/datetime";

type AttemptedTweet = {
  status: "FAILED" | "SUCCESS";
  message: string;
};

type PendingTweet = {
  status: "PENDING";
};

type ScheduledTweet = {
  uuid: string;
  blockUid: string;
  createdDate: string;
  scheduledDate: string;
} & (AttemptedTweet | PendingTweet);

const DeleteScheduledContent = ({ onConfirm }: { onConfirm: () => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), [setIsOpen]);
  const close = useCallback(() => setIsOpen(false), [setIsOpen]);
  return (
    <>
      <Button
        style={{ minHeight: 20, height: 20, minWidth: 20 }}
        icon={"trash"}
        onClick={open}
        minimal
      />
      <Alert
        isOpen={isOpen}
        onClose={close}
        canOutsideClickCancel
        cancelButtonText={"Cancel"}
        canEscapeKeyCancel
        onConfirm={onConfirm}
      >
        Are you sure you want to remove this post?
      </Alert>
    </>
  );
};

type Payload = {
  text: string;
  uid: string;
  children: Payload[];
};

const trimPayload = (node: TreeNode): Payload => ({
  text: node.text,
  uid: node.uid,
  children: node.children.map(trimPayload),
});

const EditScheduledContent = ({
  onConfirm,
  uuid,
  date,
  blockUid,
}: {
  onConfirm: (body: { date: string }) => void;
  uuid: string;
  date: Date;
  blockUid: string;
}) => {
  const initialDate = useMemo(
    () => addMinutes(startOfMinute(new Date()), 1),
    []
  );
  const [scheduleDate, setScheduleDate] = useState(date);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const open = useCallback(() => setIsOpen(true), [setIsOpen]);
  const close = useCallback(() => setIsOpen(false), [setIsOpen]);
  const payload = useMemo(() => {
    const parentUid = getParentUidByBlockUid(blockUid);
    const text = getTextByBlockUid(parentUid);
    const children = getBasicTreeByParentUid(parentUid);
    const blocks = children
      .map((t) => ({
        ...t,
        text: resolveRefs(t.text),
      }))
      .map(trimPayload);
    const tweetId = /\/([a-zA-Z0-9_]{1,15})\/status\/([0-9]*)\??/.exec(
      text
    )?.[2];
    return JSON.stringify({ blocks, tweetId });
  }, [blockUid]);
  const onClick = useCallback(() => {
    setLoading(true);
    const date = scheduleDate.toJSON();
    apiPut("social-schedule", {
      uuid,
      scheduleDate: date,
      payload,
    })
      .then(() => {
        onConfirm({ date });
        close();
      })
      .catch(() => setLoading(false));
  }, [uuid, scheduleDate, payload, onConfirm, close]);
  return (
    <>
      <Button
        style={{ minHeight: 20, height: 20, minWidth: 20 }}
        icon={"edit"}
        onClick={open}
        minimal
      />
      <Dialog
        title={"Edit Post"}
        isOpen={isOpen}
        onClose={close}
        canEscapeKeyClose
        canOutsideClickClose
        style={{ width: 256 }}
      >
        <DatePicker
          value={scheduleDate}
          onChange={setScheduleDate}
          minDate={initialDate}
          maxDate={addYears(endOfYear(initialDate), 5)}
          timePrecision={"minute"}
          highlightCurrentDay
          className={"roamjs-datepicker"}
          timePickerProps={{ useAmPm: true, showArrowButtons: true }}
        />
        <span style={{ margin: 16 }}>
          Are you sure you want to edit the time and content of this post?
        </span>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginRight: 16,
          }}
        >
          {loading && <Spinner size={Spinner.SIZE_SMALL} />}
          <Button
            onClick={onClick}
            intent={Intent.PRIMARY}
            style={{ marginLeft: 8 }}
          >
            Submit
          </Button>
        </div>
      </Dialog>
    </>
  );
};

const ScheduledDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [valid, setValid] = useState(false);
  const [scheduledTweets, setScheduledTweets] = useState<ScheduledTweet[]>([]);
  const refresh = useCallback(() => {
    setLoading(true);
    apiGet("twitter-schedule")
      .then((r) => {
        setValid(true);
        setScheduledTweets(
          (r.data.scheduledTweets as ScheduledTweet[]).sort(
            ({ createdDate: a }, { createdDate: b }) =>
              new Date(b).valueOf() - new Date(a).valueOf()
          )
        );
      })
      .catch((e)=> setError(e.response?.data && e.message))
      .finally(() => setLoading(false));
  }, [setLoading, setValid]);
  useEffect(() => {
    if (loading) {
      refresh();
    }
  }, [loading, refresh]);
  return loading ? (
    <Spinner />
  ) : valid ? (
    <>
      {scheduledTweets.length ? (
        <table
          className="bp3-html-table bp3-html-table-bordered bp3-html-table-striped"
          style={{ border: "1px solid rgba(16,22,26,0.15)" }}
        >
          <thead>
            <tr>
              <th></th>
              <th>Block</th>
              <th>Created Date</th>
              <th>Scheduled Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {scheduledTweets.map(
              ({
                uuid,
                blockUid,
                scheduledDate,
                createdDate,
                ...statusProps
              }) => {
                return (
                  <tr key={uuid}>
                    <td>
                      {statusProps.status === "PENDING" && (
                        <EditScheduledContent
                          uuid={uuid}
                          date={new Date(scheduledDate)}
                          blockUid={blockUid}
                          onConfirm={({ date }) =>
                            setScheduledTweets(
                              scheduledTweets.map((t) =>
                                t.uuid === uuid
                                  ? { ...t, scheduledDate: date }
                                  : t
                              )
                            )
                          }
                        />
                      )}
                      <DeleteScheduledContent
                        onConfirm={() =>
                          apiDelete(
                            `social-schedule?uuid=${uuid}`
                          ).then(() =>
                            setScheduledTweets(
                              scheduledTweets.filter((t) => t.uuid !== uuid)
                            )
                          )
                        }
                      />
                    </td>
                    <td>
                      <span
                        className="rm-block-ref"
                        onClick={() => openBlockInSidebar(blockUid)}
                      >
                        <span>(({blockUid}))</span>
                      </span>
                    </td>
                    <td>
                      {format(new Date(createdDate), "yyyy/MM/dd hh:mm a")}
                    </td>
                    <td>
                      {format(new Date(scheduledDate), "yyyy/MM/dd hh:mm a")}
                    </td>
                    <td>
                      {statusProps.status === "SUCCESS" && (
                        <a
                          href={statusProps.message}
                          target="_blank"
                          rel="noopener"
                          style={{ color: "darkgreen" }}
                        >
                          SUCCESS
                        </a>
                      )}
                      {statusProps.status === "PENDING" && (
                        <span style={{ color: "darkgoldenrod" }}>PENDING</span>
                      )}
                      {statusProps.status === "FAILED" && (
                        <Popover
                          content={
                            <span
                              style={{
                                color: "darkred",
                                cursor: "pointer",
                              }}
                            >
                              <div style={{ padding: 16 }}>
                                {statusProps.message}
                              </div>
                            </span>
                          }
                          target={
                            <span
                              style={{
                                color: "darkred",
                                cursor: "pointer",
                              }}
                            >
                              FAILED
                            </span>
                          }
                        />
                      )}
                    </td>
                  </tr>
                );
              }
            )}
          </tbody>
        </table>
      ) : (
        <>
          <div style={{ color: "darkgoldenrod", margin: "16px 0" }}>
            You have not scheduled any Tweets from Roam. Create a block with <code>{`{{[[tweet]]}}`}</code> to get started!
          </div>
        </>
      )}
      <Button
        minimal
        icon={"refresh"}
        onClick={refresh}
        id={"roamjs-social-refresh-button"}
        style={{ position: "absolute", top: 8, right: 8 }}
      />
    </>
  ) : (
    <div style={{ color: "darkred" }}>
      <h4>RoamJS Token is invalid.</h4>
      <p>{error}</p>
      <p>
        If you are sure this token is correct, please reach out to
        support@roamjs.com for help!
      </p>
    </div>
  );
};

export default ScheduledDashboard;
